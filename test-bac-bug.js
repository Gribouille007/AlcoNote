// Test script to reproduce BAC calculation bug
// Run with: node test-bac-bug.js

// Mock Utils class for testing
class Utils {
    static convertToStandardUnit(quantity, unit) {
        switch (unit) {
            case 'EcoCup':
                return { quantity: 25, unit: 'cL' };
            case 'L':
                return { quantity: quantity * 100, unit: 'cL' };
            case 'cL':
            default:
                return { quantity, unit: 'cL' };
        }
    }

    static calculateAlcoholGrams(volumeCL, alcoholPercent) {
        return (volumeCL * alcoholPercent * 0.8) / 10;
    }

    static calculateCurrentBAC(drinks, weightKg, gender, currentTime = new Date()) {
        if (!drinks || drinks.length === 0 || !weightKg || !gender) return 0;

        const r = gender === 'female' ? 0.55 : 0.68;
        const eliminationRate = 0.15; // g/L per hour

        console.log(`\n=== BAC Calculation Debug ===`);
        console.log(`Weight: ${weightKg}kg, Gender: ${gender}, r-value: ${r}`);
        console.log(`Current time: ${currentTime}`);
        console.log(`Total drinks to process: ${drinks.length}`);

        // 1. Parse and sort drinks chronologically
        const sortedDrinks = drinks
            .map(drink => {
                if (!drink.date || !drink.time) {
                    console.log(`⚠️ Drink missing date/time:`, drink);
                    return null;
                }

                const [y, m, d] = drink.date.split('-').map(Number);
                const [h, min] = drink.time.split(':').map(Number);
                const date = new Date(y, m - 1, d, h, min);

                if (isNaN(date.getTime())) {
                    console.log(`⚠️ Invalid date for drink:`, drink);
                    return null;
                }

                const volumeCL = this.convertToStandardUnit(drink.quantity, drink.unit).quantity;
                const alcoholGrams = this.calculateAlcoholGrams(volumeCL, drink.alcoholContent || 0);

                console.log(`\nDrink: ${drink.name}`);
                console.log(`  - DateTime: ${date}`);
                console.log(`  - Volume: ${volumeCL}cL`);
                console.log(`  - Alcohol %: ${drink.alcoholContent}`);
                console.log(`  - Alcohol grams: ${alcoholGrams}g`);

                return {
                    date: date,
                    alcoholGrams: alcoholGrams
                };
            })
            .filter(d => {
                if (d === null) return false;
                if (d.alcoholGrams <= 0) {
                    console.log(`⚠️ Filtered out drink with ${d.alcoholGrams}g alcohol`);
                    return false;
                }
                return true;
            })
            .sort((a, b) => a.date - b.date);

        console.log(`\nDrinks after filtering: ${sortedDrinks.length}`);

        if (sortedDrinks.length === 0) {
            console.log(`❌ No valid drinks found!`);
            return 0;
        }

        // 2. Simulate BAC evolution
        let currentBAC = 0;
        let lastTime = sortedDrinks[0].date;

        console.log(`\n=== Simulating BAC Evolution ===`);

        sortedDrinks.forEach((drink, i) => {
            // Calculate elimination since last event
            const timeDiffHours = (drink.date - lastTime) / (1000 * 60 * 60);

            console.log(`\nStep ${i + 1}:`);
            console.log(`  - Time diff from last: ${timeDiffHours.toFixed(2)}h`);
            console.log(`  - BAC before drink: ${currentBAC.toFixed(4)} g/L`);

            if (timeDiffHours > 0) {
                currentBAC -= eliminationRate * timeDiffHours;
                if (currentBAC < 0) currentBAC = 0;
                console.log(`  - After elimination: ${currentBAC.toFixed(4)} g/L`);
            }

            // Add new drink contribution
            const bacIncrease = drink.alcoholGrams / (weightKg * r);
            currentBAC += bacIncrease;
            console.log(`  - Alcohol added: ${drink.alcoholGrams}g → BAC increase: ${bacIncrease.toFixed(4)} g/L`);
            console.log(`  - BAC after drink: ${currentBAC.toFixed(4)} g/L`);

            lastTime = drink.date;
        });

        // 3. Calculate final elimination until current time
        const finalTimeDiffHours = (currentTime - lastTime) / (1000 * 60 * 60);
        console.log(`\n=== Final Elimination ===`);
        console.log(`Time since last drink: ${finalTimeDiffHours.toFixed(2)}h`);
        console.log(`BAC before final elimination: ${currentBAC.toFixed(4)} g/L`);

        if (finalTimeDiffHours > 0) {
            currentBAC -= eliminationRate * finalTimeDiffHours;
        }

        const finalBAC = Math.max(0, currentBAC);
        console.log(`Final BAC: ${finalBAC.toFixed(4)} g/L = ${(finalBAC * 1000).toFixed(2)} mg/L`);
        console.log(`===========================\n`);

        return finalBAC;
    }
}

// Test Cases
console.log('\n🧪 TEST CASE 1: Single beer just consumed');
const testDrinks1 = [
    {
        name: 'Beer',
        quantity: 33,
        unit: 'cL',
        alcoholContent: 5,
        date: '2025-11-21',
        time: '19:50'
    }
];

const currentTime1 = new Date(2025, 10, 21, 19, 56); // Nov 21, 2025 19:56
const bac1 = Utils.calculateCurrentBAC(testDrinks1, 75, 'male', currentTime1);
console.log(`\n✅ Result: ${(bac1 * 1000).toFixed(2)} mg/L`);
console.log(`Expected: ~260 mg/L (non-zero!)\n`);

console.log('\n🧪 TEST CASE 2: Drink without alcoholContent (null)');
const testDrinks2 = [
    {
        name: 'Water',
        quantity: 33,
        unit: 'cL',
        alcoholContent: null,
        date: '2025-11-21',
        time: '19:50'
    }
];

const bac2 = Utils.calculateCurrentBAC(testDrinks2, 75, 'male', currentTime1);
console.log(`\n✅ Result: ${(bac2 * 1000).toFixed(2)} mg/L`);
console.log(`Expected: 0 mg/L (no alcohol)\n`);

console.log('\n🧪 TEST CASE 3: Multiple drinks over time');
const testDrinks3 = [
    {
        name: 'Beer 1',
        quantity: 33,
        unit: 'cL',
        alcoholContent: 5,
        date: '2025-11-21',
        time: '18:00'
    },
    {
        name: 'Beer 2',
        quantity: 33,
        unit: 'cL',
        alcoholContent: 5,
        date: '2025-11-21',
        time: '19:00'
    },
    {
        name: 'Wine',
        quantity: 15,
        unit: 'cL',
        alcoholContent: 12,
        date: '2025-11-21',
        time: '19:30'
    }
];

const bac3 = Utils.calculateCurrentBAC(testDrinks3, 75, 'male', currentTime1);
console.log(`\n✅ Result: ${(bac3 * 1000).toFixed(2)} mg/L`);
console.log(`Expected: ~650 mg/L (above legal limit)\n`);

console.log('\n🧪 TEST CASE 4: Old drink (more than 24h ago)');
const testDrinks4 = [
    {
        name: 'Beer',
        quantity: 33,
        unit: 'cL',
        alcoholContent: 5,
        date: '2025-11-20',
        time: '10:00'
    }
];

const bac4 = Utils.calculateCurrentBAC(testDrinks4, 75, 'male', currentTime1);
console.log(`\n✅ Result: ${(bac4 * 1000).toFixed(2)} mg/L`);
console.log(`Expected: 0 mg/L (fully eliminated)\n`);
