from odoo import http
from odoo.addons.website.controllers.form import WebsiteForm


class WebsiteFormCors(WebsiteForm):
    """Re-declare the website_form routes with CORS enabled.

    Passing ``cors`` to ``http.route`` makes Odoo emit the
    ``Access-Control-Allow-Origin`` header (and answer the OPTIONS preflight),
    which is what the browser needs before it will let the static Packetflow
    site read the response of its cross-origin POST.

    The override keeps the parent's URL and other options; we only add ``cors``.
    Locked to a single origin (the main Packetflow site) rather than ``"*"``:
    the override applies to *all* website_form models, so a wildcard would let
    any site on the internet drive this Odoo instance's forms from a visitor's
    browser. The scan site forwards leads server-side (no browser CORS), so the
    only origin that still needs a browser-side POST is the main site.
    """

    _cors = "https://www.packetflow.be"

    @http.route(cors=_cors)
    def website_form(self, model_name, **kwargs):
        return super().website_form(model_name, **kwargs)

    @http.route(cors=_cors)
    def website_form_empty(self, **kwargs):
        return super().website_form_empty(**kwargs)
