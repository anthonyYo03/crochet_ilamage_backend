.OAuth Access Token:
Integration API Reference
Connect your custom website or backend system directly to MIK Online. Push real-time inventory, manage product variants, receive orders, and sync cancellations.

Obtaining an Access Token
MIK Online uses OAuth2 Client Credentials for authentication. You must exchange your Client ID and Client Secret for a short-lived Bearer token. Include this token in the Authorization header for all requests to MIK Online.

POST
https://webhook.mikonline.co/custom/v1/oauth/token

Request Body Parameters
Content-Type: application/json

Field Type Description
client_id
Req
string Your unique merchant Client ID provided by MIK Online.
client_secret
Req
string Your secure secret key. Never expose this on the frontend.
grant_type
Req
string Must be "client_credentials". Requests with any other value are rejected with 400.
Example Request Payload
json

{
"client_id": "YOUR_CLIENT_ID",
"client_secret": "YOUR_CLIENT_SECRET",
"grant_type": "client_credentials"
}
Example Response (200 OK)
json

{
"access_token": "eyJhbGciOiJIUzI1NiIsInR5...",
"token_type": "Bearer",
"expires_in": 900
}

.Integration API Reference
Connect your custom website or backend system directly to MIK Online. Push real-time inventory, manage product variants, receive orders, and sync cancellations.

1. Upsert Product
   Push product creations or updates to MIK Online. Both POST and PATCH perform a full state synchronization (upsert) based on your product id.

POST
https://webhook.mikonline.co/custom/v1/products

PATCH
https://webhook.mikonline.co/custom/v1/products/:id

Full State Synchronization (Upsert Behavior):
The payload represents the complete product state. When updating:
Existing specs or variants omitted from the payload are permanently removed.
The images array replaces the gallery. Sending images: [] clears all gallery images. Always send the complete active images array.
Root Product Payload Schema
Field Type Description
id
Req
string Your system's unique product ID (SKU). Max 255 chars. (Accepted alias: externalProductId)
title
Req
string The product title. Max 500 characters.
cover
Req
string (URL) Main cover image URL. Max 2048 chars. Must be a valid URL.
description
string HTML or plain text product description. HTML tags are stripped.
customizable
boolean Is the product customizable? Defaults to false. When true, a real customizationType ("text", "image", "both", or "full_design") must be specified.
customizationType
string Type of customization. Allowed enum values: "none", "text", "image", "both", "full_design". Must be "none" when customizable is false.
variants
Req
array[object] Array of variant objects. Must contain at least 1 variant item.
images
Req
array[object] Array of root-level gallery image objects.
addonGroups
array[object] Optional array of add-on groups (e.g. "Choose a topping", "Add engraving"). Omit this field entirely to leave existing add-ons untouched on update. Send an empty array to remove all add-ons.
Variants Object Schema
Field Type Description
id
Req
string Your unique variant ID (SKU). Must be unique per product. Max 255 chars. (Accepted alias: externalVariantId)
price
Req
number Base price. Must be a non-negative number (>= 0).
quantity
Req
integer Available stock level. Must be a non-negative integer (>= 0).
group
string Main spec group (e.g. "Green" or "Red"). Defaults to "Default" if omitted.
option
string Sub-spec option (e.g. "iPhone 13 Pro Max" or "XL"). Defaults to "Default" if omitted.
discountPrice
number Discounted price. Must be strictly lower than price.
Root Images Array Schema
Field Type Description
url
Req
string (URL) Direct image URL. Max 2048 chars.
variantId
string Optional. Must match a variant id in the same payload. Omit to assign image to all product specs.
💡 Automatic Grouping:
Variants with the same group (e.g. "Green") are automatically grouped into a single specification on MIK Online, with each distinct option (e.g. "iPhone 13 Pro Max", "iPhone 14 Pro Max") created as sub-specifications under that group.
Addon Groups Object Schema
Field Type Description
id
Req
string Your unique add-on group ID. Must be unique per product. Max 255 chars.
label
Req
string Group label shown to the customer (e.g. "Choose a topping"). Max 255 characters.
description
string Optional helper text shown under the group label. Max 2000 characters.
min
integer Minimum number of options the customer must select. Omit or set to 0 for an optional group. A value >= 1 makes the group required.
max
integer Maximum number of options the customer may select. Omit for no upper limit. Set to 1 for a single-choice group.
options
array[object] Array of add-on option objects belonging to this group. Defaults to an empty array.
💡 min / max Define Everything:
min: 1, max: 1 — required, pick exactly one.
min: 0, max: 1 — optional, pick at most one.
min: 1 (max omitted) — required, pick one or more, no upper limit.
min: 2, max: 5 — required, pick between 2 and 5.
omitted entirely — optional, pick any number.
Addon Options Object Schema
Field Type Description
id
Req
string Your unique add-on option ID. Must be unique within its group. Max 255 chars.
label
Req
string Option label shown to the customer (e.g. "Extra Cheese"). Max 255 characters.
price
Req
number Price added to the base product price when this option is selected. Must be a non-negative number (>= 0).
discountPrice
number Discounted price. Must be strictly lower than price. This is what is actually charged when present.
quantity
Req
integer Available stock for this add-on option. Must be a non-negative integer (>= 0). Re-synced on every product push, same as variant stock — send your current on-hand count each time.
available
boolean Whether this option can currently be selected. Defaults to true.
sku
string Optional SKU for this option. Max 255 characters.
image
string (URL) Optional option image URL. Max 2048 chars. Within a single group, either every option must have an image or none of them may — mixing is rejected.
All-or-Nothing Option Images:
Options within the same group must be visually consistent — either every option in the group has an image, or none of them do. A group with some options carrying an image and others not is rejected with a validation error.
💡 Add-on Sync Behavior:
Omitting addonGroups entirely leaves existing add-ons untouched. Sending addonGroups: [] removes all add-ons. Otherwise, this is a full-state sync just like variants and images — any group or option previously sent but missing from the current array is deactivated.
Complete Multi-Variant Example
json

{
"id": "PRODUCT-100",
"title": "Classic Phone Case",
"description": "Protective phone case",
"cover": "https://merchant.com/images/main.jpg",
"customizable": false,
"customizationType": "none",
"variants": [
{
"id": "PRODUCT-100-GREEN-IP13",
"group": "Green",
"option": "iPhone 13 Pro Max",
"quantity": 100,
"price": 20,
"discountPrice": 15
},
{
"id": "PRODUCT-100-GREEN-IP14",
"group": "Green",
"option": "iPhone 14 Pro Max",
"quantity": 80,
"price": 22
}
],
"images": [
{
"url": "https://merchant.com/images/general-front.jpg"
},
{
"url": "https://merchant.com/images/green-ip13.jpg",
"variantId": "PRODUCT-100-GREEN-IP13"
}
]
}
Simple Single-Variant Example
json

{
"id": "MUG-100",
"title": "Coffee Mug",
"description": "Ceramic coffee mug",
"cover": "https://merchant.com/images/mug-main.jpg",
"variants": [
{
"id": "MUG-100",
"quantity": 30,
"price": 12
}
],
"images": [
{
"url": "https://merchant.com/images/mug-main.jpg"
}
]
}
Add-on Groups Example
json

{
"id": "MUG-100",
"title": "Coffee Mug",
"cover": "https://merchant.com/images/mug-main.jpg",
"variants": [
{
"id": "MUG-100",
"quantity": 30,
"price": 12
}
],
"images": [
{
"url": "https://merchant.com/images/mug-main.jpg"
}
],
"addonGroups": [
{
"id": "ENGRAVING",
"label": "Add Engraving",
"min": 0,
"max": 1,
"options": [
{
"id": "ENGRAVING-NONE",
"label": "None",
"price": 0,
"quantity": 999,
"available": true
},
{
"id": "ENGRAVING-NAME",
"label": "Custom Name",
"price": 3.5,
"quantity": 25,
"available": true
}
]
}
]
}
Example Response (201 Created)
json

{
"success": true,
"message": "Product created",
"data": {
"productId": 1045, // MIK Online's internal DB ID
"externalProductId": "PRODUCT-100" // Your own product ID (what you sent)
}
}
productId is MIK Online's internal ID for this product. externalProductId is your own product ID, echoed back from your request.

Example Response (200 OK - Update)
json

{
"success": true,
"message": "Product updated",
"data": {
"productId": 1045, // MIK Online's internal DB ID
"externalProductId": "PRODUCT-100" // Your own product ID, echoed back
}
} 2. Deactivate Product
Performs a soft-delete. The product is hidden from the marketplace, and all variant quantities are immediately set to 0. You can reactivate it anytime by pushing a POST/PATCH request.

DELETE
https://webhook.mikonline.co/custom/v1/products/:id

Example Delete Request
http

DELETE /custom/v1/products/PRODUCT-100 HTTP/1.1
Host: webhook.mikonline.co
Authorization: Bearer YOUR_ACCESS_TOKEN
Example Deactivate Response (200 OK)
json

{
"success": true,
"message": "Product deactivated",
"data": {
"productId": 1045, // MIK Online's internal DB ID
"externalProductId": "PRODUCT-100", // Your own product ID
"deactivated": true
}
}

.Webhook authentication
Integration API Reference
Connect your custom website or backend system directly to MIK Online. Push real-time inventory, manage product variants, receive orders, and sync cancellations.

MIK Online → Your System
These are endpoints that your system must host. MIK Online calls them using your configured base URL.

Authentication for MIK Online Requests
When MIK Online sends requests to your integration API, it authenticates using the method configured for your store.

Option A: Static API Key
Provide a long-lived API key in the MIK Admin Dashboard. MIK Online includes it in the Authorization header with every request sent to your API.

http

Authorization: Bearer YOUR_STATIC_API_KEY
Option B: OAuth Client Credentials
Provide a client ID and client secret to MIK Online. MIK Online uses them to request a short-lived access token from your authentication endpoint.

POST
{your_base_url}/mikonline/v1/oauth/token

Content-Type: application/json

MIK Online caches the access token until it expires and sends it in the Authorization header with requests to your API:

http

Authorization: Bearer YOUR_ACCESS_TOKEN
If a request returns 401 Unauthorized, MIK Online clears the cached access token and requests a new token before the next request.

OAuth: Request Payload
json

{
"grant_type": "client_credentials",
"client_id": "mik_client_id",
"client_secret": "mik_secret"
}
OAuth: Expected Response
json

{
"access_token": "YOUR_ACCESS_TOKEN",
"token_type": "Bearer",
"expires_in": 3600
}

.Webhook Product list

MIK Online → Your System
These are endpoints that your system must host. MIK Online calls them using your configured base URL.

Fetch Products List
MIK Online calls this endpoint to perform initial product synchronization or periodic inventory reconciliation.

GET
{your_base_url}/mikonline/v1/products

Query Parameters
Field Type Description
page
integer Page number for pagination. Defaults to 1.
limit
integer Number of items per page. Defaults to 100.
updatedAfter
string (ISO 8601) Filter items modified after timestamp (e.g. 2026-07-24T00:00:00Z).
Header required: Authorization: Bearer YOUR_ACCESS_TOKEN

Request Body: None (GET request)

Expected HTTP Status: 200 OK

Example Request sent by MIK
http

GET /mikonline/v1/products?page=1&limit=100 HTTP/1.1
Host: your-merchant-domain.com
Authorization: Bearer YOUR_ACCESS_TOKEN
Accept: application/json
Expected Response (200 OK)
json

{
"success": true,
"products": [
{
"id": "PRODUCT-100",
"title": "Classic Phone Case",
"description": "Protective phone case",
"cover": "https://merchant.com/images/main.jpg",
"customizable": false,
"customizationType": "none",
"variants": [
{
"id": "PRODUCT-100-GREEN-IP13",
"group": "Green",
"option": "iPhone 13 Pro Max",
"quantity": 100,
"price": 20,
"discountPrice": 15
}
],
"images": [
{
"url": "https://merchant.com/images/general-front.jpg"
},
{
"url": "https://merchant.com/images/green-ip13.jpg",
"variantId": "PRODUCT-100-GREEN-IP13"
}
],
"addonGroups": [
{
"id": "ENGRAVING",
"label": "Add Engraving",
"min": 0,
"max": 1,
"options": [
{
"id": "ENGRAVING-NONE",
"label": "None",
"price": 0,
"quantity": 999
},
{
"id": "ENGRAVING-NAME",
"label": "Custom Name",
"price": 3.5,
"quantity": 25
}
]
}
]
}
],
"pagination": {
"page": 1,
"limit": 100,
"total": 1
}
}

.
Integration API Reference
Connect your custom website or backend system directly to MIK Online. Push real-time inventory, manage product variants, receive orders, and sync cancellations.

MIK Online → Your System
These are endpoints that your system must host. MIK Online calls them using your configured base URL.

1. Receive New Order
   MIK Online calls this route when a customer completes a checkout. Your system must process the order and return your external order ID.
   Idempotency Requirement: You must implement deduplication on your end based on the MIK orderId.

POST
{your_base_url}/mikonline/v1/orders

Header required: Authorization: Bearer YOUR_ACCESS_TOKEN

Expected HTTP Status: 201 Created

Root Order Payload Schema
Field Type Description
orderId
Req
string Unique MIK Online order ID.
status
Req
string Initial order status. Always "processing".
itemsTotal
Req
number Sum of itemTotal across every item in the order (addons and quantity included).
items
Req
array[object] Array of ordered items.
Order Items Schema
Field Type Description
externalProductId
Req
string Your unique product ID (SKU / supplieritemid).
externalVariantId
Req
string Your unique variant ID (SKU / suppliersubitemid).
quantity
Req
integer Quantity ordered.
price
Req
number Unit price at purchase (original price or discount price). Does not include add-on price — see addons and itemTotal.
itemTotal
Req
number (price + sum of addons[].price) × quantity — the full amount charged for this line item, addons included.
customText
string Optional customer text customization.
customImageUrl
string (URL) Optional customer design image URL.
customMetadata
string Optional additional metadata.
addons
array[object] Selected add-on options for this item, if any. Empty array when the item has no add-ons.
💡 itemTotal vs itemsTotal — not a duplicate:
itemTotal (on each item) is that one line's total — (price + sum of addons[].price) × quantity. itemsTotal (at the order root) is the sum of every item's itemTotal combined. With a single-item order they happen to match, as in the example — with multiple items they won't.
Addon Object Schema
Field Type Description
externalGroupId
Req
string Your add-on group id, echoed back from the id you sent in addonGroups when syncing this product.
externalOptionId
Req
string Your add-on option id, echoed back from addonGroups[].options[].id.
groupLabel
Req
string Add-on group label shown to the customer (e.g. "Add Engraving").
optionLabel
Req
string Selected option label within that group (e.g. "Custom Name").
price
Req
number Price of this add-on option, already included in the order total charged to the customer.
Payload sent by MIK
json

{
"orderId": "54321",
"status": "processing",
"itemsTotal": 38.50,
"items": [
{
"externalProductId": "PRODUCT-100",
"externalVariantId": "PRODUCT-100-GREEN-IP13",
"quantity": 1,
"price": 15.00,
"itemTotal": 18.50,
"customText": "Happy Birthday",
"customImageUrl": "https://api.mikonline.co/uploads/custom_designs/design-123.webp",
"customMetadata": "",
"addons": [
{
"externalGroupId": "ENGRAVING",
"externalOptionId": "ENGRAVING-NAME",
"groupLabel": "Add Engraving",
"optionLabel": "Custom Name",
"price": 3.5
}
]
},
{
"externalProductId": "MUG-100",
"externalVariantId": "MUG-100",
"quantity": 2,
"price": 10.00,
"itemTotal": 20.00,
"customText": "",
"customImageUrl": "",
"customMetadata": "",
"addons": []
}
]
}
Item 1: (15.00 + 3.50 add-on) × 1 = 18.50. Item 2: 10.00 × 2 = 20.00, no add-ons. itemsTotal = 18.50 + 20.00 = 38.50.

Expected Response (201 Created)
json

{
"success": true,
"externalOrderId": "YOUR-SYS-ORD-99"
} 2. Order Status Update
When an order status changes on MIK Online (such as an order cancellation), MIK Online posts the status update to your system.

PATCH
{your_base_url}/mikonline/v1/orders/:externalOrderId/status

Path Parameter: :externalOrderId

Header required: Authorization: Bearer YOUR_ACCESS_TOKEN

Expected HTTP Status: 200 OK

Valid Order Statuses
Field Type Description
processing
string Order placed and created on MIK Online.
collecting
string Order is being collected / picked.
collected
string Order items collected from store branch.
centralwarehouse
string Order arrived at MIK central warehouse.
out for delivery
string Order out with driver for customer delivery.
delivered
string Order delivered to customer.
cancelled
string Order cancelled.
returned
string Order returned or refunded.
Payload sent by MIK
json

{
"status": "cancelled",
"reason": "Customer requested cancellation"
}
Expected Response (200 OK)
json

{
"success": true,
"message": "Order status updated successfully"
}
