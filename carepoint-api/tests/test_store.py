from apps.store.models import OpeningHours, StoreSettings

from .helpers import BaseTest, auth_client, make_admin

WEEK = [{"day": d, "opensAt": "08:00", "closesAt": "21:00", "isClosed": False} for d in range(7)]


class PublicStore(BaseTest):
    def test_shape(self):
        r = self.client.get("/api/store").json()
        self.assertEqual(set(r), {"name", "phone", "phoneHref", "address", "hours", "stats"})
        self.assertEqual(r["phoneHref"], "tel:+923000000000")
        self.assertEqual(len(r["hours"]), 7)
        self.assertEqual(set(r["stats"]), {"avgRefillMinutes", "yearsServing", "ordersCompleted"})

    def test_does_not_leak_who_edited(self):
        self.assertNotIn("updatedBy", self.client.get("/api/store").json())


class AdminStore(BaseTest):
    def setUp(self):
        super().setUp()
        self.admin = make_admin()
        self.api = auth_client(self.admin)

    def test_edit_updates_the_single_row(self):
        r = self.api.patch("/api/admin/store", {"phone": "0300 7654321"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(StoreSettings.objects.count(), 1)
        store = StoreSettings.load()
        self.assertEqual(store.phone, "0300 7654321")
        self.assertEqual(store.updated_by, self.admin)

    def test_cannot_delete_settings(self):
        with self.assertRaises(RuntimeError):
            StoreSettings.load().delete()

    def test_hours_update_only_marks_changed_days(self):
        week = [dict(d) for d in self.api.get("/api/admin/hours").json()]
        week[5] = {"day": 5, "opensAt": "09:00", "closesAt": "02:00", "isClosed": False}  # Friday, past midnight
        r = self.api.put("/api/admin/hours", week, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(OpeningHours.objects.get(day_of_week=5).updated_by, self.admin)
        self.assertIsNone(OpeningHours.objects.get(day_of_week=1).updated_by)
        self.assertEqual(OpeningHours.objects.count(), 7)

    def test_closed_day_drops_times(self):
        week = [dict(d) for d in WEEK]
        week[0] = {"day": 0, "opensAt": "10:00", "closesAt": "16:00", "isClosed": True}
        self.api.put("/api/admin/hours", week, format="json")
        sunday = OpeningHours.objects.get(day_of_week=0)
        self.assertTrue(sunday.is_closed)
        self.assertIsNone(sunday.opens_at)

    def test_open_day_needs_times(self):
        week = [dict(d) for d in WEEK]
        week[2] = {"day": 2, "isClosed": False}
        self.assertEqual(self.api.put("/api/admin/hours", week, format="json").status_code, 400)

    def test_must_send_all_seven_days_once(self):
        self.assertEqual(self.api.put("/api/admin/hours", WEEK[:6], format="json").status_code, 400)
        self.assertEqual(self.api.put("/api/admin/hours", WEEK[:6] + [WEEK[0]], format="json").status_code, 400)
