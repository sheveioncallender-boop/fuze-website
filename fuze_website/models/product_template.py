from odoo import fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    fuze_website_published = fields.Boolean(
        string="Published on Fuze Website",
        help="Show this product in the branded Fuze menu and allow website ordering.",
    )
    fuze_website_key = fields.Char(string="Fuze Website Key", copy=False, index=True)
    fuze_website_description = fields.Text(string="Website Description", translate=True)
    fuze_website_tags = fields.Char(
        string="Website Tags",
        help="Comma-separated labels such as favourite, spicy or vegetarian.",
    )
    fuze_website_sequence = fields.Integer(string="Website Sequence", default=10)
    fuze_pos_config_ids = fields.Many2many(
        "pos.config",
        "fuze_product_pos_config_rel",
        "product_tmpl_id",
        "config_id",
        string="Available at Fuze Locations",
        help="Leave empty to sell at every Fuze website location.",
    )
    fuze_station_ids = fields.Many2many(
        "fuze.kitchen.station",
        "fuze_product_station_rel",
        "product_tmpl_id",
        "station_id",
        string="Preparation Stations",
    )

    _fuze_website_key_unique = models.Constraint(
        "UNIQUE(fuze_website_key)",
        "The Fuze website key must be unique.",
    )
