from odoo import api, fields, models


class PaymentTransaction(models.Model):
    _inherit = "payment.transaction"

    fuze_pos_order_id = fields.Many2one("pos.order", string="Fuze POS Order", copy=False, index=True)

    @api.model_create_multi
    def create(self, vals_list):
        orders = self.env["pos.order"].sudo().search(
            [("fuze_website_order", "=", True), ("fuze_payment_state", "=", "pending")],
            order="id desc",
            limit=200,
        )
        for vals in vals_list:
            reference = vals.get("reference") or ""
            order = orders.filtered(
                lambda candidate: reference == candidate.fuze_order_reference
                or reference.startswith((candidate.fuze_order_reference or "") + "-")
            )[:1]
            if order:
                vals["fuze_pos_order_id"] = order.id
        return super().create(vals_list)

    def _set_done(self, *args, **kwargs):
        result = super()._set_done(*args, **kwargs)
        for transaction in self.filtered("fuze_pos_order_id"):
            transaction.fuze_pos_order_id.sudo()._fuze_capture_online_payment(transaction)
        return result

    def _set_canceled(self, *args, **kwargs):
        result = super()._set_canceled(*args, **kwargs)
        self.filtered("fuze_pos_order_id").mapped("fuze_pos_order_id").sudo().write(
            {"fuze_payment_state": "failed"}
        )
        return result

    def _set_error(self, *args, **kwargs):
        result = super()._set_error(*args, **kwargs)
        self.filtered("fuze_pos_order_id").mapped("fuze_pos_order_id").sudo().write(
            {"fuze_payment_state": "failed"}
        )
        return result
