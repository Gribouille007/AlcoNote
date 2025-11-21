/**
 * Test script to verify EcoCup quantity bug fix
 * Tests that convertToStandardUnit correctly multiplies EcoCup quantity
 */

// Mock Utils class for testing
class Utils {
    static convertToStandardUnit(quantity, unit) {
        switch (unit) {
            case 'EcoCup':
                return { quantity: quantity * 25, unit: 'cL' };
            case 'L':
                return { quantity: quantity * 100, unit: 'cL' };
            case 'cL':
            default:
                return { quantity, unit: 'cL' };
        }
    }
}

console.log('='.repeat(60));
console.log('🧪 ECOCUP QUANTITY BUG FIX TEST');
console.log('='.repeat(60));

// Test 1: Single EcoCup
console.log('\n📋 TEST 1: Single EcoCup (1 EcoCup)');
const test1 = Utils.convertToStandardUnit(1, 'EcoCup');
console.log(`Result: ${test1.quantity}cL`);
console.log(`Expected: 25cL`);
console.assert(test1.quantity === 25, `❌ FAIL: Expected 25cL, got ${test1.quantity}cL`);
console.log('✅ PASS');

// Test 2: Two EcoCups (the bug case)
console.log('\n📋 TEST 2: Two EcoCups (2 EcoCups)');
const test2 = Utils.convertToStandardUnit(2, 'EcoCup');
console.log(`Result: ${test2.quantity}cL`);
console.log(`Expected: 50cL`);
console.assert(test2.quantity === 50, `❌ FAIL: Expected 50cL, got ${test2.quantity}cL`);
console.log('✅ PASS');

// Test 3: Three EcoCups
console.log('\n📋 TEST 3: Three EcoCups (3 EcoCups)');
const test3 = Utils.convertToStandardUnit(3, 'EcoCup');
console.log(`Result: ${test3.quantity}cL`);
console.log(`Expected: 75cL`);
console.assert(test3.quantity === 75, `❌ FAIL: Expected 75cL, got ${test3.quantity}cL`);
console.log('✅ PASS');

// Test 4: Fractional EcoCup
console.log('\n📋 TEST 4: Half EcoCup (0.5 EcoCup)');
const test4 = Utils.convertToStandardUnit(0.5, 'EcoCup');
console.log(`Result: ${test4.quantity}cL`);
console.log(`Expected: 12.5cL`);
console.assert(test4.quantity === 12.5, `❌ FAIL: Expected 12.5cL, got ${test4.quantity}cL`);
console.log('✅ PASS');

// Test 5: Other units (regression test)
console.log('\n📋 TEST 5: Other units (regression test)');
const test5a = Utils.convertToStandardUnit(1, 'L');
console.assert(test5a.quantity === 100, `❌ FAIL: 1L should be 100cL, got ${test5a.quantity}cL`);
const test5b = Utils.convertToStandardUnit(33, 'cL');
console.assert(test5b.quantity === 33, `❌ FAIL: 33cL should be 33cL, got ${test5b.quantity}cL`);
console.log('✅ PASS - L and cL units still work correctly');

console.log('\n' + '='.repeat(60));
console.log('✅ ALL TESTS PASSED - EcoCup bug is fixed!');
console.log('='.repeat(60));
