# Bazion MCP servers — planned boundary

MCP is an AI integration layer, not the implementation of a website's cart or checkout. Build it after the commerce API and authorization model are stable.

Planned first tools:

- `catalog_search`: read-only product discovery scoped to the authenticated tenant.
- `cart_get`: read a cart only when the caller is authorized for that cart.
- `cart_add_item`: add a product after checking caller, tenant and cart access.
- `checkout_create`: high-impact action; requires explicit customer/agent confirmation and idempotency key.
- `order_status`: read-only order status for an authorized customer/staff member.

Never expose direct SQL, raw payment credentials, unrestricted customer search, or payment confirmation as an AI-callable tool. MCP tools should call the same application service layer and permissions as the normal API. Use the current official MCP TypeScript SDK v2 when implementation begins; keep the MCP server as a separate app/package so it can be deployed independently.
