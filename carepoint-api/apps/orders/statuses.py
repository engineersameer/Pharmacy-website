from .models import Order

S = Order.Status

# Which status an order may move to next. Anything not listed here is refused.
_NEXT = {
    S.RECEIVED: {S.CONFIRMED, S.CANCELLED},
    S.READY: {S.COMPLETED, S.CANCELLED},
    S.OUT_FOR_DELIVERY: {S.COMPLETED, S.CANCELLED},
    S.COMPLETED: set(),
    S.CANCELLED: set(),
}


def allowed_next(order: Order) -> set[str]:
    if order.status == S.CONFIRMED:
        # After confirming: pickup orders become "ready", delivery orders go "out for delivery"
        step = S.READY if order.method == Order.Method.PICKUP else S.OUT_FOR_DELIVERY
        return {step, S.CANCELLED}
    return _NEXT[order.status]
