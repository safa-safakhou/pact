# Identity connection inventory

### Connection inventory during access expiry

Identity's owner-authenticated inventory accepts an injected OAuth refresh-expiry
reader. OAuth exposes only the latest valid unused refresh expiry per owned grant;
no token/hash leaves that module. An unrevoked grant with expired access stays
visible while a refresh is available. Used, expired or revoked refresh credentials
cannot keep a connection visible. Access expiry and connection expiry are distinct;
an inventory read never refreshes credentials or starts inference.
