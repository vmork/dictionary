DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM collections WHERE owner_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot require collection owners while unclaimed collections remain';
  END IF;
END
$$;

ALTER TABLE collections ALTER COLUMN owner_id SET NOT NULL;
