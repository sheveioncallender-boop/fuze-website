from odoo import api, fields, models
from odoo.exceptions import ValidationError


class FuzeKitchenStation(models.Model):
    _name = "fuze.kitchen.station"
    _description = "Fuze Preparation Station"
    _order = "sequence, name"

    name = fields.Char(required=True, translate=True)
    code = fields.Char(required=True, index=True)
    active = fields.Boolean(default=True)
    sequence = fields.Integer(default=10)
    color = fields.Char(default="#2d0055")
    company_id = fields.Many2one("res.company", default=lambda self: self.env.company)
    pos_config_ids = fields.Many2many(
        "pos.config",
        "fuze_station_pos_config_rel",
        "station_id",
        "config_id",
        string="POS Locations",
        help="Leave empty to make this station available at every configured Fuze location.",
    )
    pos_category_ids = fields.Many2many(
        "pos.category",
        "fuze_station_pos_category_rel",
        "station_id",
        "category_id",
        string="Default POS Categories",
        help="Products in these categories use this station when no product-specific station is set.",
    )

    _fuze_station_code_unique = models.Constraint(
        "UNIQUE(code, company_id)",
        "The station code must be unique per company.",
    )

    @api.constrains("code")
    def _check_code(self):
        for station in self:
            if station.code and not station.code.replace("_", "").isalnum():
                raise ValidationError("Station codes may contain only letters, numbers and underscores.")


class FuzeKitchenDisplay(models.Model):
    _name = "fuze.kitchen.display"
    _description = "Fuze Kitchen Display"
    _order = "name"

    name = fields.Char(required=True, default="Fuze Kitchen Display")
    active = fields.Boolean(default=True)
    company_id = fields.Many2one("res.company", default=lambda self: self.env.company)
    pos_config_ids = fields.Many2many(
        "pos.config",
        "fuze_display_pos_config_rel",
        "display_id",
        "config_id",
        string="POS Locations",
        help="Leave empty to show all Fuze-enabled POS locations.",
    )
    station_ids = fields.Many2many(
        "fuze.kitchen.station",
        "fuze_display_station_rel",
        "display_id",
        "station_id",
        string="Stations",
        help="Leave empty to show all stations.",
    )
    sound_enabled = fields.Boolean(default=True)
    repeat_sound = fields.Boolean(default=True)
    repeat_seconds = fields.Integer(default=20)
    volume = fields.Integer(default=70)
    show_images = fields.Boolean(default=True)
    density = fields.Selection(
        [("comfortable", "Comfortable"), ("compact", "Compact")],
        default="comfortable",
        required=True,
    )
    urgent_after = fields.Integer(default=15, help="Minutes before an active ticket is highlighted as urgent.")

    @api.constrains("volume", "repeat_seconds", "urgent_after")
    def _check_settings(self):
        for display in self:
            if not 0 <= display.volume <= 100:
                raise ValidationError("Volume must be between 0 and 100.")
            if display.repeat_seconds < 5:
                raise ValidationError("Repeat interval must be at least 5 seconds.")
            if display.urgent_after < 1:
                raise ValidationError("Urgent time must be at least 1 minute.")

    def action_open_display(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_url",
            "name": self.name,
            "url": "/fuze/kitchen?display_id=%s" % self.id,
            "target": "self",
        }
