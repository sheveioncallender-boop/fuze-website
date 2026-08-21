from odoo import fields, models


class PosConfig(models.Model):
    _inherit = "pos.config"

    fuze_branch_code = fields.Selection(
        [("east", "East Gates Mall"), ("bagshot", "Bagshot BoxPark")],
        string="Fuze Website Branch",
        copy=False,
    )
    fuze_branch_display_name = fields.Char(string="Website Branch Name")
    fuze_branch_phone = fields.Char(string="Website Phone")
    fuze_branch_address = fields.Char(string="Website Address")
    fuze_online_ordering = fields.Boolean(string="Accept Website Orders")
    fuze_delivery_enabled = fields.Boolean(string="Offer Website Delivery")
    fuze_delivery_fee = fields.Monetary(
        string="Website Delivery Fee",
        currency_field="currency_id",
        help="Flat delivery fee added by Odoo to the website POS order for this location.",
    )
    fuze_kds_enabled = fields.Boolean(string="Send Orders to Fuze KDS", default=True)
    fuze_online_payment_method_id = fields.Many2one(
        "pos.payment.method",
        string="Online Card POS Payment Method",
        domain="[('id', 'in', payment_method_ids)]",
        help="Used to record a successful Odoo online-card transaction on the native POS order.",
    )
    fuze_store_payment_method_id = fields.Many2one(
        "pos.payment.method",
        string="Card at Store POS Payment Method",
        domain="[('id', 'in', payment_method_ids)]",
        help="Used after staff confirm that the branch card terminal approved a pay-at-store order.",
    )

    _fuze_branch_code_company_unique = models.Constraint(
        "UNIQUE(fuze_branch_code, company_id)",
        "A Fuze website branch can only be assigned once per company.",
    )
