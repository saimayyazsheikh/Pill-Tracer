const { query, closeConnection } = require('./connection');
const oracledb = require('oracledb');

// Extensive Pakistani Medicine Data
const medicines = [
    // Pain Relief & Fever
    { name: 'Panadol', description: 'Paracetamol 500mg - Pain relief and fever reducer' },
    { name: 'Disprin', description: 'Aspirin 300mg - Pain relief and anti-inflammatory' },
    { name: 'Brufen', description: 'Ibuprofen 400mg - Anti-inflammatory and pain relief' },
    { name: 'Ponstan', description: 'Mefenamic Acid 500mg - Pain relief for menstrual cramps' },
    { name: 'Calpol', description: 'Paracetamol Suspension - For children fever and pain' },

    // Antibiotics
    { name: 'Augmentin', description: 'Amoxicillin + Clavulanic Acid - Broad spectrum antibiotic' },
    { name: 'Flagyl', description: 'Metronidazole 400mg - Antibiotic for bacterial infections' },
    { name: 'Zithromax', description: 'Azithromycin 500mg - Antibiotic for respiratory infections' },
    { name: 'Ciproxin', description: 'Ciprofloxacin 500mg - Antibiotic for urinary tract infections' },
    { name: 'Amoxil', description: 'Amoxicillin 500mg - Penicillin antibiotic' },

    // Gastrointestinal
    { name: 'Motilium', description: 'Domperidone 10mg - Anti-nausea and digestive aid' },
    { name: 'Risek', description: 'Omeprazole 20mg - Proton pump inhibitor for acidity' },
    { name: 'Nexium', description: 'Esomeprazole 40mg - Treatment for GERD and ulcers' },
    { name: 'Imodium', description: 'Loperamide 2mg - Anti-diarrheal medication' },
    { name: 'Pepto-Bismol', description: 'Bismuth Subsalicylate - Upset stomach and diarrhea relief' },

    // Respiratory
    { name: 'Ventolin', description: 'Salbutamol Inhaler - Bronchodilator for asthma' },
    { name: 'Benadryl', description: 'Diphenhydramine - Antihistamine for allergies' },
    { name: 'Actifed', description: 'Pseudoephedrine + Triprolidine - Cold and flu relief' },
    { name: 'Rynex', description: 'Cough syrup with expectorant' },
    { name: 'Mucolator', description: 'Ambroxol - Mucolytic for productive cough' },

    // Cardiovascular
    { name: 'Concor', description: 'Bisoprolol 5mg - Beta blocker for hypertension' },
    { name: 'Norvasc', description: 'Amlodipine 5mg - Calcium channel blocker for blood pressure' },
    { name: 'Lipitor', description: 'Atorvastatin 20mg - Cholesterol lowering medication' },
    { name: 'Aspirin Cardio', description: 'Aspirin 100mg - Blood thinner for heart health' },
    { name: 'Plavix', description: 'Clopidogrel 75mg - Antiplatelet medication' },

    // Diabetes
    { name: 'Glucophage', description: 'Metformin 500mg - Oral diabetes medication' },
    { name: 'Diamicron', description: 'Gliclazide 80mg - Diabetes management' },
    { name: 'Januvia', description: 'Sitagliptin 100mg - DPP-4 inhibitor for diabetes' },

    // Vitamins & Supplements
    { name: 'Centrum', description: 'Multivitamin supplement' },
    { name: 'Neurobion', description: 'Vitamin B complex - Nerve health' },
    { name: 'Calcium-D', description: 'Calcium + Vitamin D3 - Bone health' },
    { name: 'Folic Acid', description: 'Vitamin B9 - Essential for pregnancy' },
    { name: 'Ferrous Sulfate', description: 'Iron supplement for anemia' },

    // Dermatological
    { name: 'Betnovate', description: 'Betamethasone cream - Anti-inflammatory skin cream' },
    { name: 'Fucidin', description: 'Fusidic Acid - Antibiotic cream for skin infections' },
    { name: 'Canesten', description: 'Clotrimazole - Antifungal cream' },

    // Mental Health
    { name: 'Xanax', description: 'Alprazolam 0.5mg - Anti-anxiety medication' },
    { name: 'Lexapro', description: 'Escitalopram 10mg - Antidepressant' },
    { name: 'Stilnox', description: 'Zolpidem 10mg - Sleep aid' },

    // Others
    { name: 'Gravinate', description: 'Dimenhydrinate - Motion sickness prevention' },
    { name: 'Cetirizine', description: 'Antihistamine for allergies' },
    { name: 'Dolo-Neurobion', description: 'Diclofenac + Vitamin B - Pain relief with nerve support' },
    { name: 'Lyrica', description: 'Pregabalin 75mg - Neuropathic pain relief' },
    { name: 'Voltaren', description: 'Diclofenac gel - Topical pain relief' }
];

// Pakistani Cities and Branches
const branches = [
    // Karachi
    { name: 'Sehat Pharmacy', address: 'Clifton Block 2', city: 'Karachi', country: 'Pakistan' },
    { name: 'Medix Pharmacy', address: 'Gulshan-e-Iqbal', city: 'Karachi', country: 'Pakistan' },
    { name: 'CureMed Pharmacy', address: 'DHA Phase 5', city: 'Karachi', country: 'Pakistan' },
    { name: 'HealthPlus Pharmacy', address: 'Saddar', city: 'Karachi', country: 'Pakistan' },
    { name: 'MediCare Center', address: 'North Nazimabad', city: 'Karachi', country: 'Pakistan' },

    // Lahore
    { name: 'Shifa Pharmacy', address: 'Gulberg III', city: 'Lahore', country: 'Pakistan' },
    { name: 'Life Pharmacy', address: 'DHA Phase 3', city: 'Lahore', country: 'Pakistan' },
    { name: 'Dawakhana Tibbiya', address: 'Mall Road', city: 'Lahore', country: 'Pakistan' },
    { name: 'Green Pharmacy', address: 'Johar Town', city: 'Lahore', country: 'Pakistan' },
    { name: 'MediPlus Pharmacy', address: 'Model Town', city: 'Lahore', country: 'Pakistan' },

    // Islamabad
    { name: 'Capital Pharmacy', address: 'F-7 Markaz', city: 'Islamabad', country: 'Pakistan' },
    { name: 'Metro Pharmacy', address: 'Blue Area', city: 'Islamabad', country: 'Pakistan' },
    { name: 'Remedy Pharmacy', address: 'G-9 Markaz', city: 'Islamabad', country: 'Pakistan' },
    { name: 'HealthCare Pharmacy', address: 'I-8 Markaz', city: 'Islamabad', country: 'Pakistan' },

    // Rawalpindi
    { name: 'City Pharmacy', address: 'Saddar Bazaar', city: 'Rawalpindi', country: 'Pakistan' },
    { name: 'Trust Pharmacy', address: 'Bahria Town Phase 4', city: 'Rawalpindi', country: 'Pakistan' },
    { name: 'Wellness Pharmacy', address: 'Commercial Market', city: 'Rawalpindi', country: 'Pakistan' },

    // Faisalabad
    { name: 'Madina Pharmacy', address: 'D Ground', city: 'Faisalabad', country: 'Pakistan' },
    { name: 'Al-Shifa Pharmacy', address: 'Peoples Colony', city: 'Faisalabad', country: 'Pakistan' },
    { name: 'Care Pharmacy', address: 'Susan Road', city: 'Faisalabad', country: 'Pakistan' },

    // Multan
    { name: 'Nishtar Pharmacy', address: 'Nishtar Road', city: 'Multan', country: 'Pakistan' },
    { name: 'Pharma Plus', address: 'Gulgasht Colony', city: 'Multan', country: 'Pakistan' },

    // Peshawar
    { name: 'Khyber Pharmacy', address: 'Saddar Road', city: 'Peshawar', country: 'Pakistan' },
    { name: 'Rehman Pharmacy', address: 'University Town', city: 'Peshawar', country: 'Pakistan' },

    // Quetta
    { name: 'Balochistan Pharmacy', address: 'Jinnah Road', city: 'Quetta', country: 'Pakistan' },
    { name: 'Mountain Pharmacy', address: 'Satellite Town', city: 'Quetta', country: 'Pakistan' },

    // Sialkot
    { name: 'Sialkot Pharmacy', address: 'Paris Road', city: 'Sialkot', country: 'Pakistan' },

    // Gujranwala
    { name: 'Gujranwala MediCenter', address: 'GT Road', city: 'Gujranwala', country: 'Pakistan' },

    // Hyderabad
    { name: 'Hyderabad Pharmacy', address: 'Latifabad', city: 'Hyderabad', country: 'Pakistan' },

    // Abbottabad
    { name: 'Hill Station Pharmacy', address: 'Mall Road', city: 'Abbottabad', country: 'Pakistan' }
];

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding (Oracle)...\n');

        // Clear existing tables
        console.log('🗑️  Clearing existing data...');
        await query('DELETE FROM inventory_records');
        await query('DELETE FROM medicines');
        await query('DELETE FROM branches WHERE firebase_uid IS NULL'); // Only delete seed branches

        // Insert medicines
        console.log('💊 Inserting medicines...');
        const medicineIds = [];

        for (const med of medicines) {
            const result = await query(
                'INSERT INTO medicines (name, description) VALUES (:1, :2) RETURNING id INTO :3',
                [med.name, med.description, { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }]
            );
            if (result.insertId) {
                medicineIds.push(result.insertId);
            }
        }
        console.log(`   ✓ Inserted ${medicineIds.length} medicines`);

        // Insert branches
        console.log('🏪 Inserting branches...');
        const branchIds = [];

        for (const branch of branches) {
            const result = await query(
                'INSERT INTO branches (name, address, city, country) VALUES (:1, :2, :3, :4) RETURNING id INTO :5',
                [branch.name, branch.address, branch.city, branch.country, { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }]
            );
            if (result.insertId) {
                branchIds.push(result.insertId);
            }
        }
        console.log(`   ✓ Inserted ${branchIds.length} branches`);

        // Generate inventory records
        console.log('📦 Generating inventory records...');
        let inventoryCount = 0;

        for (const branchId of branchIds) {
            // Each branch will have 20-35 random medicines
            const numMedicines = Math.floor(Math.random() * 16) + 20;
            const selectedMedicines = [];

            while (selectedMedicines.length < numMedicines) {
                const randomMedId = medicineIds[Math.floor(Math.random() * medicineIds.length)];
                if (!selectedMedicines.includes(randomMedId)) {
                    selectedMedicines.push(randomMedId);
                }
            }

            for (const medicineId of selectedMedicines) {
                const price = Math.floor(Math.random() * 1500) + 50;
                const quantity = Math.floor(Math.random() * 200) + 10;

                await query(
                    'INSERT INTO inventory_records (medicine_id, branch_id, price, quantity) VALUES (:1, :2, :3, :4)',
                    [medicineId, branchId, price, quantity]
                );
                inventoryCount++;
            }
        }

        console.log(`   ✓ Inserted ${inventoryCount} inventory records`);

        console.log('\n✅ Database seeding completed successfully!\n');
        console.log('📊 Summary:');
        console.log(`   • ${medicineIds.length} medicines`);
        console.log(`   • ${branchIds.length} branches across Pakistan`);
        console.log(`   • ${inventoryCount} inventory records`);
        console.log('\n🎉 Ready to start the server!\n');

        await closeConnection();
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        await closeConnection();
        process.exit(1);
    }
}

// Run seeding if this file is executed directly
if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase };
