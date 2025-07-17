#!/bin/bash

# GANTAVYAM Test Runner Script
# This script runs all tests and generates a report

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
SERVER_URL="http://localhost:5000"
LOG_FILE="test-results-$(date +%Y%m%d-%H%M%S).log"

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     GANTAVYAM TEST RUNNER                 ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Function to check if server is running
check_server() {
    echo -e "${YELLOW}Checking if server is running...${NC}"
    
    # Try to connect to server
    if curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/api/status" | grep -q "200"; then
        echo -e "${GREEN}✓ Server is running at $SERVER_URL${NC}"
        return 0
    else
        echo -e "${RED}✗ Server is not running!${NC}"
        echo -e "${YELLOW}Please start the server with: npm start${NC}"
        return 1
    fi
}

# Function to check MongoDB connection
check_mongodb() {
    echo -e "${YELLOW}Checking MongoDB connection...${NC}"
    
    # Check server status endpoint
    STATUS=$(curl -s "$SERVER_URL/api/status" | grep -o '"connected":[^,]*' | cut -d':' -f2)
    
    if [[ "$STATUS" == "true" ]]; then
        echo -e "${GREEN}✓ MongoDB is connected${NC}"
        return 0
    else
        echo -e "${RED}✗ MongoDB connection failed${NC}"
        return 1
    fi
}

# Function to install dependencies if needed
check_dependencies() {
    echo -e "${YELLOW}Checking test dependencies...${NC}"
    
    if ! npm list node-fetch >/dev/null 2>&1; then
        echo -e "${YELLOW}Installing node-fetch...${NC}"
        npm install node-fetch
    fi
    
    if ! npm list socket.io-client >/dev/null 2>&1; then
        echo -e "${YELLOW}Installing socket.io-client...${NC}"
        npm install socket.io-client
    fi
    
    echo -e "${GREEN}✓ All dependencies installed${NC}"
}

# Function to run the main test suite
run_tests() {
    echo ""
    echo -e "${BLUE}Running Test Suite...${NC}"
    echo -e "${YELLOW}Logging to: $LOG_FILE${NC}"
    echo ""
    
    # Make test file executable
    chmod +x test-ride-flow.js
    
    # Run tests and capture output
    node test-ride-flow.js 2>&1 | tee "$LOG_FILE"
    
    # Capture exit code
    TEST_EXIT_CODE=${PIPESTATUS[0]}
    
    return $TEST_EXIT_CODE
}

# Function to generate test report
generate_report() {
    echo ""
    echo -e "${BLUE}═══ TEST REPORT ═══${NC}"
    
    # Extract test results from log
    PASSED=$(grep -c "✅" "$LOG_FILE" || echo "0")
    FAILED=$(grep -c "❌" "$LOG_FILE" || echo "0")
    TOTAL=$((PASSED + FAILED))
    
    if [ $TOTAL -gt 0 ]; then
        PASS_RATE=$((PASSED * 100 / TOTAL))
    else
        PASS_RATE=0
    fi
    
    echo -e "Total Tests: ${TOTAL}"
    echo -e "${GREEN}Passed: ${PASSED}${NC}"
    echo -e "${RED}Failed: ${FAILED}${NC}"
    echo -e "Pass Rate: ${PASS_RATE}%"
    echo ""
    
    # Show failed tests if any
    if [ $FAILED -gt 0 ]; then
        echo -e "${RED}Failed Tests:${NC}"
        grep "❌" "$LOG_FILE" | sed 's/.*❌/  -/'
    fi
    
    echo ""
    echo -e "Full log saved to: ${YELLOW}$LOG_FILE${NC}"
}

# Function to run quick smoke test
quick_test() {
    echo -e "${BLUE}Running Quick Smoke Test...${NC}"
    
    # Test admin login
    echo -n "Testing Admin Login... "
    ADMIN_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/admin/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@admin.com","password":"admin@123"}')
    
    if echo "$ADMIN_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
    
    # Test user login
    echo -n "Testing User Login... "
    USER_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/users/login" \
        -H "Content-Type: application/json" \
        -d '{"phone":"0000000000","password":"Demo@123"}')
    
    if echo "$USER_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
    
    # Test driver login
    echo -n "Testing Driver Login... "
    DRIVER_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/drivers/login" \
        -H "Content-Type: application/json" \
        -d '{"phone":"0000000000","password":"Demo@123"}')
    
    if echo "$DRIVER_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
}

# Main execution
main() {
    # Parse command line arguments
    if [ "$1" == "--quick" ] || [ "$1" == "-q" ]; then
        quick_test
        exit 0
    fi
    
    # Pre-flight checks
    if ! check_server; then
        exit 1
    fi
    
    if ! check_mongodb; then
        exit 1
    fi
    
    check_dependencies
    
    # Run full test suite
    if run_tests; then
        echo -e "${GREEN}✓ All tests completed successfully!${NC}"
        generate_report
        exit 0
    else
        echo -e "${RED}✗ Some tests failed!${NC}"
        generate_report
        exit 1
    fi
}

# Show usage
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --quick, -q    Run quick smoke tests only"
    echo "  --help, -h     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0             # Run full test suite"
    echo "  $0 --quick     # Run quick tests only"
    exit 0
fi

# Run main function
main "$@"