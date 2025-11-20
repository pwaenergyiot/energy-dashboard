// ========================================
// SOLAR ANALYSIS
// ========================================

// Solar Analysis Function
async function loadSolarData() {
    try {
        // Get settings
        const startDate = document.getElementById('solar-startDate').value;
        const endDate = document.getElementById('solar-endDate').value;
        const solarStart = parseInt(document.getElementById('solar-startHour').value);
        const solarEnd = parseInt(document.getElementById('solar-endHour').value);
        const capacity = parseFloat(document.getElementById('solar-capacity').value);
        const efficiency = parseFloat(document.getElementById('solar-efficiency').value);

        if (!startDate || !endDate) {
            showAlert('error', 'กรุณาเลือกวันที่');
            return;
        }

        if (solarStart >= solarEnd) {
            showAlert('error', 'Solar Start ต้องน้อยกว่า Solar End');
            return;
        }

        if (capacity <= 0 || efficiency <= 0 || efficiency > 100) {
            showAlert('error', 'กรุณากรอกข้อมูล Solar ให้ถูกต้อง');
            return;
        }

        // Show loading
        showLoading('solar-results');
        document.getElementById('solar-results').classList.remove('hidden');

        // Get phase info
        const phaseInfo = JSON.parse(localStorage.getItem('phaseInfo') || '{}');
        
        // Call API based on phase count
        let data;
        if (phaseInfo.is3Phase) {
            // 3-phase system
            data = await callAPI('getData3Phase', {
                startDate: startDate,
                endDate: endDate,
                solarStartHour: solarStart,
                solarEndHour: solarEnd
            });
        } else {
            // 1-phase system
            data = await callAPI('getPhaseData', {
                phase: 'A',
                startDate: startDate,
                endDate: endDate,
                solarStartHour: solarStart,
                solarEndHour: solarEnd
            });
        }

        // Process Solar analysis
        const solarResults = analyzeSolar(data, phaseInfo, {
            solarStart: solarStart,
            solarEnd: solarEnd,
            capacity: capacity,
            efficiency: efficiency
        });

        // Display results
        displaySolarResults(solarResults);

    } catch (error) {
        console.error('Solar Analysis error:', error);
        showAlert('error', 'เกิดข้อผิดพลาด: ' + error.message);
    }
}

// ========================================
// SOLAR CALCULATION
// ========================================

function analyzeSolar(apiData, phaseInfo, settings) {
    let solarData;
    
    if (phaseInfo.is3Phase && apiData.total && apiData.total.solarData) {
        solarData = apiData.total.solarData;
    } else if (apiData.data && apiData.data.solarData) {
        solarData = apiData.data.solarData;
    } else {
        throw new Error('ไม่พบข้อมูล Solar Period');
    }

    const results = {
        totalSolarUsage: solarData.totalSolar || 0,
        avgPerDay: solarData.avgPerDay || 0,
        avgPerHour: solarData.avgPerHour || 0,
        peakHour: solarData.peakHour || 12,
        peakEnergy: solarData.peakEnergy || 0,
        solarDaily: solarData.solarDaily || [],
        solarHourly: solarData.solarHourly || [],
        
        // Calculate solar installation metrics
        solarPeriodHours: settings.solarEnd - settings.solarStart,
        estimatedGeneration: 0,
        coveragePercent: 0,
        savingsEstimate: 0,
        paybackYears: 0
    };

    // Estimate solar generation
    // Assume average 4-5 peak sun hours per day in Thailand
    const avgPeakSunHours = 4.5;
    const daysInPeriod = results.solarDaily.length || 30;
    
    results.estimatedGeneration = settings.capacity * avgPeakSunHours * (settings.efficiency / 100) * daysInPeriod;
    
    // Calculate coverage
    if (results.totalSolarUsage > 0) {
        results.coveragePercent = Math.min((results.estimatedGeneration / results.totalSolarUsage) * 100, 100);
    }

    // Calculate savings (assuming peak rate)
    const peakRate = parseFloat(document.getElementById('tou-peakRate')?.value || 4.50);
    results.savingsEstimate = Math.min(results.estimatedGeneration, results.totalSolarUsage) * peakRate;
    
    // Estimate yearly savings
    const yearlySavings = results.savingsEstimate * (365 / daysInPeriod);
    
    // Estimate payback period (rough estimate)
    const installCost = settings.capacity * 50000; // Assume 50,000 baht per kW
    if (yearlySavings > 0) {
        results.paybackYears = installCost / yearlySavings;
    }

    return results;
}

// ========================================
// DISPLAY RESULTS
// ========================================

function displaySolarResults(results) {
    // Display statistics
    displaySolarStats(results);

    // Display charts
    displaySolarCharts(results);
}

function displaySolarStats(results) {
    const statsDiv = document.getElementById('solar-stats');
    
    statsDiv.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">การใช้ในช่วงแสงแดด</div>
                <div class="stat-value">${results.totalSolarUsage.toFixed(2)}</div>
                <div class="stat-unit">kWh</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">เฉลี่ยต่อวัน</div>
                <div class="stat-value">${results.avgPerDay.toFixed(2)}</div>
                <div class="stat-unit">kWh/day</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">เฉลี่ยต่อชั่วโมง</div>
                <div class="stat-value">${results.avgPerHour.toFixed(2)}</div>
                <div class="stat-unit">kWh/hour</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">Peak Hour</div>
                <div class="stat-value">${results.peakHour}</div>
                <div class="stat-unit">น.</div>
            </div>
        </div>

        <div class="alert alert-info" style="margin-top: 20px;">
            <h3>💡 Solar Installation Analysis</h3>
            <p><strong>Solar Capacity:</strong> ${document.getElementById('solar-capacity').value} kW</p>
            <p><strong>ผลผลิตโซลาร์เซลล์โดยประมาณ:</strong> ${results.estimatedGeneration.toFixed(2)} kWh</p>
            <p><strong>% ครอบคลุมการใช้ในช่วงแสงแดด:</strong> ${results.coveragePercent.toFixed(1)}%</p>
            <p><strong>ประหยัดได้โดยประมาณ:</strong> ${results.savingsEstimate.toFixed(2)} บาท</p>
            <p><strong>ประมาณการคืนทุน:</strong> ${results.paybackYears.toFixed(1)} ปี</p>
        </div>

        <div class="alert ${results.coveragePercent >= 80 ? 'alert-success' : results.coveragePercent >= 50 ? 'alert-info' : 'alert-error'}" style="margin-top: 15px;">
            <strong>คำแนะนำ:</strong><br>
            ${getSolarRecommendation(results.coveragePercent)}
        </div>
    `;
}

function getSolarRecommendation(coveragePercent) {
    if (coveragePercent >= 80) {
        return '✅ ระบบโซลาร์เซลล์ขนาดนี้เหมาะสมมาก! สามารถครอบคลุมการใช้ไฟฟ้าในช่วงกลางวันได้เกือบทั้งหมด';
    } else if (coveragePercent >= 50) {
        return '⚠️ ระบบโซลาร์เซลล์สามารถครอบคลุมการใช้ไฟฟ้าได้ประมาณครึ่งหนึ่ง อาจพิจารณาเพิ่มขนาดระบบ';
    } else if (coveragePercent >= 30) {
        return '⚠️ ระบบโซลาร์เซลล์ครอบคลุมการใช้ไฟฟ้าได้น้อย แนะนำให้เพิ่มขนาดระบบหรือลดการใช้ไฟฟ้าในช่วงกลางวัน';
    } else {
        return '❌ การใช้ไฟฟ้าในช่วงกลางวันสูงมาก ระบบโซลาร์เซลล์ขนาดนี้อาจไม่คุ้มค่า ควรปรับพฤติกรรมการใช้ไฟฟ้าก่อน';
    }
}

function displaySolarCharts(results) {
    // Chart 1: Daily Solar Usage
    if (results.solarDaily && results.solarDaily.length > 0) {
        const labels = results.solarDaily.map(d => d.date);
        const values = results.solarDaily.map(d => d.solar);

        createLineChart('solar-usage-chart',
            labels,
            [{
                label: 'การใช้ไฟฟ้าในช่วงแสงแดด (kWh)',
                data: values,
                borderColor: '#ffc107',
                backgroundColor: 'rgba(255, 193, 7, 0.1)',
                tension: 0.4
            }],
            'การใช้ไฟฟ้ารายวันในช่วงแสงแดด'
        );
    }

    // Chart 2: Savings Comparison
    const capacity = parseFloat(document.getElementById('solar-capacity').value);
    const scenarios = [
        { label: 'ไม่ติด Solar', value: 0 },
        { label: 'ติด Solar ' + capacity + ' kW', value: results.savingsEstimate }
    ];

    createBarChart('solar-savings-chart',
        scenarios.map(s => s.label),
        [{
            label: 'ค่าไฟฟ้า (บาท)',
            data: scenarios.map(s => results.savingsEstimate - s.value),
            backgroundColor: ['#FF6384', '#4BC0C0']
        }],
        'เปรียบเทียบค่าไฟฟ้า'
    );
}

// ========================================
// EXPORT
// ========================================

window.loadSolarData = loadSolarData;
