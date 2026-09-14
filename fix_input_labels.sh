#!/bin/bash

# Fix Input components with label props by wrapping them with label elements

files=(
  "components/admin/BlogEditorForm.tsx"
  "components/admin/DoorCardTable.tsx"
  "components/admin/SettingsForm.tsx"
  "components/admin/SiteGateForm.tsx"
)

for file in "${files[@]}"; do
  echo "Processing $file..."

  # Create a temporary Python script to process the file
  python3 << 'PYTHON_SCRIPT'
import re
import sys

file_path = sys.argv[1]

with open(file_path, 'r') as f:
    content = f.read()

# Pattern to match <Input label="..." ... />
pattern = r'<Input\s+label="([^"]+)"([^/>]*)/>'

def replace_input(match):
    label_text = match.group(1)
    other_props = match.group(2).strip()

    return f'''<label style={{{{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: tokens.colors.textMuted }}}}>
            {label_text}
          </label>
          <Input{other_props}/>'''

content = re.sub(pattern, replace_input, content)

with open(file_path, 'w') as f:
    f.write(content)

print(f"Fixed {file_path}")
PYTHON_SCRIPT
python3 -c "
import re
import sys

file_path = '$file'

with open(file_path, 'r') as f:
    content = f.read()

# Pattern to match <Input label=\"...\" ... />
pattern = r'<Input\s+label=\"([^\"]+)\"([^/>]*)/>'

def replace_input(match):
    label_text = match.group(1)
    other_props = match.group(2).strip()

    return f'''<label style={{{{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: tokens.colors.textMuted }}}}>
            {label_text}
          </label>
          <Input{other_props}/>'''

content = re.sub(pattern, replace_input, content)

with open(file_path, 'w') as f:
    f.write(content)

print(f'Fixed {file_path}')
" "$file"
done

echo "All files processed!"
