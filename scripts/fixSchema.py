import re

with open('supabase/migrations/20260418000000_init.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# 1. Remove storage permissions alter
sql = sql.replace("ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;", "-- Removed storage.objects ALTER to prevent permission errors")

# 2. Make all policies idempotent
lines = sql.split('\n')
new_lines = []
for line in lines:
    match = re.match(r'CREATE POLICY "(.+?)" ON ([a-zA-Z0-9_\.]+)', line)
    if match:
        policy_name = match.group(1)
        table_name = match.group(2)
        new_lines.append(f'DROP POLICY IF EXISTS "{policy_name}" ON {table_name};')
    new_lines.append(line)

with open('supabase/migrations/20260418000000_init.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

