-- Same exclusive lease, explicitly labeled by the optional external transport.
ALTER TABLE write_leases DROP CONSTRAINT write_leases_holder_kind_check;
ALTER TABLE write_leases ADD CONSTRAINT write_leases_holder_kind_check CHECK(holder_kind IN ('pact_run','mcp','script','a2a'));
