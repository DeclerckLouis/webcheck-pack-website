from odoo import http
from odoo.addons.website.controllers.form import WebsiteForm


class WebsiteFormCors(WebsiteForm):
    """Re-declare the website_form routes with CORS enabled.

    Passing ``cors`` to ``http.route`` makes Odoo emit the
    ``Access-Control-Allow-Origin`` header (and answer the OPTIONS preflight),
    which is what the browser needs before it will let the static Packetflow
    site read the response of its cross-origin POST.

    The override keeps the parent's URL and other options; we only add ``cors``.
    Use a single origin (e.g. ``"https://www.packetflow.be"``) to lock it down,
    or ``"*"`` to allow any origin — fine here since the endpoint is public,
    POST-only and does not use cookies/credentials.
    """

    _cors = "*"

    @http.route(cors=_cors)
    def website_form(self, model_name, **kwargs):
        return super().website_form(model_name, **kwargs)

    @http.route(cors=_cors)
    def website_form_empty(self, **kwargs):
        return super().website_form_empty(**kwargs)
