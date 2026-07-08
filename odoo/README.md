# Odoo integration

The contact form (`src/pages/contact.astro`) creates a lead/opportunity in
Odoo CRM by POSTing to Odoo's built-in **website_form** endpoint:

```
POST {PUBLIC_ODOO_URL}/website/form/crm.lead
```

Default `PUBLIC_ODOO_URL` is `https://louisdeclerck.odoo.com`.

## How submission works (and why there's usually nothing to install)

The form sends a `multipart/form-data` POST, which is a CORS **"simple
request"**. That means the browser sends it cross-origin *without a preflight*,
Odoo processes it and **creates the lead**, and only *reading the response* is
blocked by the browser. The front-end uses `fetch(..., { mode: "no-cors" })`
and shows an optimistic success — so on **Odoo Online (SaaS)**, where custom
modules cannot be installed, **no Odoo-side change is needed**.

Prerequisites on the Odoo side (all standard, no code):

1. **`crm.lead` must be form-enabled.** The stock *Contact Us* form already
   does this (module `website_crm`). To confirm: edit any page → drop a **Form**
   block → set *Action* to "Create a Lead/Opportunity". That proves `crm.lead`
   and the fields below are on the website-form allowlist.
2. The form sends these fields → `crm.lead`:
   | Form field | crm.lead field |
   | --- | --- |
   | Naam | `contact_name` |
   | E-mail | `email_from` |
   | Telefoon | `phone` |
   | Bedrijf / kantoor | `partner_name` |
   | Bericht | `description` |
   | _(derived)_ | `name` = "Website-aanvraag — {naam}" |

## Testing

**Server-side reachability (bypasses the browser CORS read-block):**

```bash
curl -i -X POST https://louisdeclerck.odoo.com/website/form/crm.lead \
  -F "contact_name=Test Lead" \
  -F "email_from=test@example.be" \
  -F "phone=0470000000" \
  -F "description=Testbericht via curl" \
  -F "name=Website-aanvraag — Test Lead"
```

Expect `HTTP/1.1 200` and a body like `{"id": 1234}`, and a new record under
**CRM → Leads**. If you get a 4xx, `crm.lead` isn't form-enabled (do step 1).

**Browser end-to-end:** open the contact page, submit the form, and confirm a
lead appears in CRM. With `no-cors` you'll always see the success state unless
the network is down, so trust the CRM record as the source of truth.

## Optional: `packetflow_form_cors` (only for Odoo.sh / self-hosted)

If you ever move off Odoo Online to **Odoo.sh or a self-hosted** instance and
want the front-end to *verify* the response (read the real `{id}` and show a
true error on failure), install the `packetflow_form_cors/` module here. It
adds `Access-Control-Allow-Origin` to the website_form route so a normal
(non-`no-cors`) fetch can read the response.

Install (Odoo.sh): commit the module to your Odoo.sh repo's addons path, or on
self-hosted drop it in an addons directory, then **Apps → Update Apps List →
install "Packetflow — Website Form CORS"**. Restrict the origin by editing
`_cors` in `controllers/main.py` (defaults to `"*"`). After installing, switch
the `fetch` in `contact.astro` back to a normal request to read `{id}`.

> This module will **not** install on Odoo Online (SaaS) — custom Python
> modules aren't allowed there. That's why the default approach above needs no
> module at all.
