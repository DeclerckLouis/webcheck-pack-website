{
    "name": "Packetflow — Website Form CORS",
    "summary": "Allow the Packetflow static website to submit website_form leads cross-origin.",
    "description": """
Adds an Access-Control-Allow-Origin header to Odoo's website_form submission
endpoint (/website/form/<model>) so the Packetflow website — hosted on a
different origin (GitHub Pages / www.packetflow.be) than this Odoo instance —
can POST the contact form and create crm.lead records from the browser.

The endpoint is POST-only, public, and does not rely on cookies/credentials,
so a wildcard origin is acceptable. To restrict it to a single domain, change
the `cors` value in controllers/main.py.
""",
    "version": "1.0.0",
    "license": "LGPL-3",
    "author": "Packetflow",
    "website": "https://www.packetflow.be",
    "category": "Website",
    "depends": ["website"],
    "installable": True,
    "application": False,
}
