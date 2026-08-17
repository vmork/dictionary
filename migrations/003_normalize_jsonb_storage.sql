UPDATE words
SET dict_entry = (dict_entry #>> '{}')::jsonb
WHERE jsonb_typeof(dict_entry) = 'string';

UPDATE words
SET practice_data = (practice_data #>> '{}')::jsonb
WHERE jsonb_typeof(practice_data) = 'string';
