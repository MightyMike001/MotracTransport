#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Test Setup ---
# Create a dummy orders.json file with some existing data
cat > orders.json << EOL
[
  {
    "id": 1,
    "klantNaam": "Test Klant 1"
  },
  {
    "id": 3,
    "klantNaam": "Test Klant 3"
  }
]
EOL

# Create a dummy new_item.json, simulating the output from the 'extract' step
cat > new_item.json << EOL
{
  "klantNaam": "Nieuwe Klant"
}
EOL

echo "--- Test Files Created ---"
echo "orders.json:"
cat orders.json
echo ""
echo "new_item.json:"
cat new_item.json
echo ""

# --- Run the Logic from the GitHub Action ---
echo "--- Running ID Generation Logic ---"
# 1. Bepaal het volgende ID
max_id=$(jq '[.[] .id] | max // 0' orders.json)
next_id=$((max_id + 1))

echo "Max ID found: $max_id"
echo "Next ID calculated: $next_id"

# 2. Voeg metadata en het nieuwe ID toe
jq --argjson id "$next_id" \
   '. + {id:$id}' new_item.json > new_item_with_meta.json

echo ""
echo "new_item_with_meta.json created:"
cat new_item_with_meta.json
echo ""

# 3. Voeg het nieuwe item toe aan de array
tmp=$(mktemp)
jq --slurp '.[0] + [.[1]]' orders.json new_item_with_meta.json > "$tmp"
mv "$tmp" orders.json

echo "--- Verification ---"
echo "Final orders.json:"
cat orders.json
echo ""

# --- Assertions ---
# Verify the new item has the correct ID
new_item_id=$(jq '.[] | select(.klantNaam == "Nieuwe Klant") | .id' orders.json)

echo "ID of new item in file: $new_item_id"
echo "Expected ID: $next_id"

if [ "$new_item_id" -ne "$next_id" ]; then
    echo "TEST FAILED: New item ID is incorrect!"
    exit 1
fi

# Verify the highest ID in the file is now the new ID
final_max_id=$(jq '[.[] .id] | max' orders.json)
if [ "$final_max_id" -ne "$next_id" ]; then
    echo "TEST FAILED: Final max ID is incorrect!"
    exit 1
fi

echo "--- Test Passed! ---"

# --- Cleanup ---
rm orders.json new_item.json new_item_with_meta.json
