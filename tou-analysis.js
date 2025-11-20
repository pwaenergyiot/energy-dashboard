// ========================================
// TOU ANALYSIS
// ========================================

// TOU Analysis Function
async function loadTouData() {
    try {
        // Get settings
        const startDate = document.getElementById('tou-startDate').value;
        const endDate = document.getElementById('tou-endDate').value;
        const peakStart = parseInt(document.getElementById('tou-peakStart').value);
        const peakEnd = parseInt(document.getElementById('tou-peakEnd').value);
        const peakRate = parseFloat(document.getElementById('tou-peakRate').value);
        const offpeakRate = parseFloat(document.getElementById('tou-offpeakRate').value);
        const holidayRate = parseFloat(document.getElementById('tou-holidayRate').value);

        if (!startDate || !endDate) {
            showAlert('error', 'กรุณาเลือกวันที่');
            return;
        }

        if (peakStart >= peakEnd) {
            showAlert('error', 'Peak Start ต้องน้อยกว่า Peak End');
            return;
        }

        // Show loading
        showLoading('tou-results');
        document.getElementById('tou-results').classList.remove('hidden');

        // Get phase info
        const phaseInfo = JSON.parse(localStorage.getItem('phaseInfo') || '{}');
        
        // Call API based on phase count
        let data;
        if (phaseInfo.is3Phase) {
            // 3-phase system
            data = await callAPI('getData3Phase', {
                startDate: startDate,
                endDate: endDate,
                solarStartHour: 6,
                solarEndHour: 18
            });
        } else {
            // 1-phase system
            data = await callAPI('getPhaseData', {
                phase: 'A',
                startDate: startDate,
                endDate: endDate,
                solarStartHour: 6,
                solarEndHour: 18
            });
        }

        // Process TOU analysis
        const touResults = calculateTOU(data, phaseInfo, {
            peakStart: peakStart,
            peakEnd: peakEnd,
            peakRate: peakRate,
            offpeakRate: offpeakRate,
            holidayRate: holidayRate
        });

        // Display results
        displayTouResults(touResults, phaseInfo);

    } catch (error) {
        console.error('TOU Analysis error:', error);
        showAlert('error', 'เกิดข้อผิดพลาด: ' + error.message);
    }
}

// ========================================
// TOU CALCULATION
// ========================================

function calculateTOU(apiData, phaseInfo, rates) {
    const results = {
        phases: {},
        total: {},
        summary: {}
    };

    if (phaseInfo.is3Phase) {
        // Calculate for each phase
        ['phaseA', 'phaseB', 'phaseC'].forEach(phase => {
            if (apiData[phase] && apiData[phase].hourlyData) {
                results.phases[phase] = calculatePhaseTO U(apiData[phase].hourlyData, rates);
            }
        });

        // Calculate total
        if (apiData.total && apiData.total.hourlyData) {
            results.total = calculatePhaseTOU(apiData.total.hourlyData, rates);
        }
    } else {
        // Single phase
        if (apiData.data && apiData.data.hourlyData) {
            results.phases.phaseA = calculatePhaseTOU(apiData.data.hourlyData, rates);
            results.total = results.phases.phaseA;
        }
    }

    // Calculate summary
    results.summary = calculateSummary(results.total);

    return results;
}

function calculatePhaseTOU(hourlyData, rates) {
    const tou = {
        type0: { peak: 0, offpeak: 0, peakCost: 0, offpeakCost: 0, totalEnergy: 0, totalCost: 0 },
        type1: { energy: 0, cost: 0 },
        type2: { energy: 0, cost: 0 },
        overall: { totalEnergy: 0, totalCost: 0, peakEnergy: 0, offpeakEnergy: 0, holidayEnergy: 0 }
    };

    hourlyData.forEach(record => {
        const hour = parseInt(record.hour);
        const energy = parseFloat(record.energy) || 0;
        const type = parseInt(record.type) || 0;

        if (type === 0) {
            // Type 0: วันปกติ - แยก Peak/Off-peak
            if (hour >= rates.peakStart && hour < rates.peakEnd) {
                // Peak period
                tou.type0.peak += energy;
                tou.type0.peakCost += energy * rates.peakRate;
                tou.overall.peakEnergy += energy;
            } else {
                // Off-peak period
                tou.type0.offpeak += energy;
                tou.type0.offpeakCost += energy * rates.offpeakRate;
                tou.overall.offpeakEnergy += energy;
            }
            tou.type0.totalEnergy += energy;
            tou.type0.totalCost += (hour >= rates.peakStart && hour < rates.peakEnd) 
                ? energy * rates.peakRate 
                : energy * rates.offpeakRate;
        } else if (type === 1) {
            // Type 1: วันหยุดนักขัตฤกษ์ - ราคาเดียวทั้งวัน
            tou.type1.energy += energy;
            tou.type1.cost += energy * rates.holidayRate;
            tou.overall.holidayEnergy += energy;
        } else if (type === 2) {
            // Type 2: วันหยุดเสาร์-อาทิตย์ - ราคาเดียวทั้งวัน
            tou.type2.energy += energy;
            tou.type2.cost += energy * rates.holidayRate;
            tou.overall.holidayEnergy += energy;
        }
    });

    // Calculate overall totals
    tou.overall.totalEnergy = tou.type0.totalEnergy + tou.type1.energy + tou.type2.energy;
    tou.overall.totalCost = tou.type0.totalCost + tou.type1.cost + tou.type2.cost;

    return tou;
}

function calculateSummary(totalTou) {
    const summary = {
        totalEnergy: totalTou.overall.totalEnergy,
        totalCost: totalTou.overall.totalCost,
        avgRate: 0,
        peakPercent: 0,
        offpeakPercent: 0,
        holidayPercent: 0,
        potentialSavings: 0
    };

    if (summary.totalEnergy > 0) {
        summary.avgRate = summary.totalCost / summary.totalEnergy;
        summary.peakPercent = (totalTou.overall.peakEnergy / summary.totalEnergy) * 100;
        summary.offpeakPercent = (totalTou.overall.offpeakEnergy / summary.totalEnergy) * 100;
        summary.holidayPercent = (totalTou.overall.holidayEnergy / summary.totalEnergy) * 100;

        // Calculate potential savings if shifted from peak to off-peak
        const peakRate = parseFloat(document.getElementById('tou-peakRate').value);
        const offpeakRate = parseFloat(document.getElementById('tou-offpeakRate').value);
        summary.potentialSavings = totalTou.overall.peakEnergy * (peakRate - offpeakRate);
    }

    return summary;
}

// ========================================
// DISPLAY RESULTS
// ========================================

function displayTouResults(results, phaseInfo) {
    // Display phase info
    displayPhaseInfo(phaseInfo);

    // Display statistics
    displayTouStats(results.summary);

    // Display breakdown table
    displayTouBreakdown(results.total);

    // Display charts
    displayTouCharts(results.total);
}

function displayPhaseInfo(phaseInfo) {
    const infoDiv = document.getElementById('tou-phase-info');
    const phaseClass = phaseInfo.is3Phase ? 'phase-badge-3' : 'phase-badge-1';
    const phaseText = phaseInfo.is3Phase ? '3 เฟส' : '1 เฟส';
    
    infoDiv.innerHTML = `
        <div class="alert alert-info">
            <strong>ระบบที่ตรวจพบ:</strong> 
            <span class="phase-badge ${phaseClass}">${phaseText}</span><br>
            <strong>Phases:</strong> ${phaseInfo.phases ? phaseInfo.phases.join(', ') : 'A'}
        </div>
    `;
}

function displayTouStats(summary) {
    const statsDiv = document.getElementById('tou-stats');
    
    statsDiv.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">พลังงานรวม</div>
                <div class="stat-value">${summary.totalEnergy.toFixed(2)}</div>
                <div class="stat-unit">kWh</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">ค่าไฟฟ้ารวม</div>
                <div class="stat-value">${summary.totalCost.toFixed(2)}</div>
                <div class="stat-unit">บาท</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">อัตราเฉลี่ย</div>
                <div class="stat-value">${summary.avgRate.toFixed(2)}</div>
                <div class="stat-unit">บาท/kWh</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">ประหยัดได้สูงสุด</div>
                <div class="stat-value">${summary.potentialSavings.toFixed(2)}</div>
                <div class="stat-unit">บาท</div>
            </div>
        </div>
    `;
}

function displayTouBreakdown(totalTou) {
    const breakdownDiv = document.getElementById('tou-breakdown');
    
    breakdownDiv.innerHTML = `
        <table class="tou-table">
            <thead>
                <tr>
                    <th>ประเภทวัน</th>
                    <th>ช่วงเวลา</th>
                    <th>พลังงาน (kWh)</th>
                    <th>ค่าไฟฟ้า (บาท)</th>
                    <th>เปอร์เซ็นต์</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td rowspan="2"><strong>วันปกติ (Type 0)</strong></td>
                    <td>Peak</td>
                    <td>${totalTou.type0.peak.toFixed(2)}</td>
                    <td>${totalTou.type0.peakCost.toFixed(2)}</td>
                    <td>${((totalTou.type0.peak / totalTou.overall.totalEnergy) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                    <td>Off-Peak</td>
                    <td>${totalTou.type0.offpeak.toFixed(2)}</td>
                    <td>${totalTou.type0.offpeakCost.toFixed(2)}</td>
                    <td>${((totalTou.type0.offpeak / totalTou.overall.totalEnergy) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                    <td colspan="2"><strong>วันหยุดนักขัตฤกษ์ (Type 1)</strong></td>
                    <td>${totalTou.type1.energy.toFixed(2)}</td>
                    <td>${totalTou.type1.cost.toFixed(2)}</td>
                    <td>${((totalTou.type1.energy / totalTou.overall.totalEnergy) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                    <td colspan="2"><strong>วันหยุดสุดสัปดาห์ (Type 2)</strong></td>
                    <td>${totalTou.type2.energy.toFixed(2)}</td>
                    <td>${totalTou.type2.cost.toFixed(2)}</td>
                    <td>${((totalTou.type2.energy / totalTou.overall.totalEnergy) * 100).toFixed(1)}%</td>
                </tr>
                <tr style="background-color: #f0f0f0; font-weight: bold;">
                    <td colspan="2">รวมทั้งหมด</td>
                    <td>${totalTou.overall.totalEnergy.toFixed(2)}</td>
                    <td>${totalTou.overall.totalCost.toFixed(2)}</td>
                    <td>100%</td>
                </tr>
            </tbody>
        </table>
    `;
}

function displayTouCharts(totalTou) {
    // Chart 1: Energy by Type
    createPieChart('tou-type-chart',
        ['วันปกติ (Peak)', 'วันปกติ (Off-Peak)', 'วันหยุดนักขัตฤกษ์', 'วันหยุดสุดสัปดาห์'],
        [
            totalTou.type0.peak,
            totalTou.type0.offpeak,
            totalTou.type1.energy,
            totalTou.type2.energy
        ],
        'การกระจายการใช้ไฟฟ้า'
    );

    // Chart 2: Cost Comparison
    createBarChart('tou-cost-chart',
        ['Peak', 'Off-Peak', 'Holiday', 'Weekend'],
        [{
            label: 'ค่าไฟฟ้า (บาท)',
            data: [
                totalTou.type0.peakCost,
                totalTou.type0.offpeakCost,
                totalTou.type1.cost,
                totalTou.type2.cost
            ],
            backgroundColor: [
                '#FF6384',
                '#36A2EB',
                '#FFCE56',
                '#4BC0C0'
            ]
        }],
        'เปรียบเทียบค่าไฟฟ้า'
    );

    // Chart 3: Hourly pattern (mock data - would need actual hourly breakdown)
    // This would require more detailed data from the API
    const hourLabels = Array.from({length: 24}, (_, i) => `${i}:00`);
    const mockHourlyData = Array.from({length: 24}, () => Math.random() * 10);
    
    createLineChart('tou-hourly-chart',
        hourLabels,
        [{
            label: 'การใช้ไฟฟ้าเฉลี่ย (kWh)',
            data: mockHourlyData,
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            tension: 0.4
        }],
        'รูปแบบการใช้ไฟฟ้ารายชั่วโมง'
    );
}

// ========================================
// EXPORT
// ========================================

window.loadTouData = loadTouData;
