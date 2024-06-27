#!/bin/bash
# Deploy without HA
flyctl deploy --ha=false

# Scale count to 1
flyctl scale count 1 -y

# Get the first machine ID
MACHINE_ID=$(flyctl machine list -q | head -n 1)

# Start the machine using the machine ID
flyctl machine start $MACHINE_ID
