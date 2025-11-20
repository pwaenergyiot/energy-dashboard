// ========================================
// YEAR ANALYSIS
// ========================================

// Year Analysis Function
async function loadYearData() {
    try {
        // Get settings
        const year = parseInt(document.getElementById('year-select').value);

        if (!year) {
            showAlert('error', 'กรุณาเลือกปี');
            return;
        }

        // Show loading
        showLoading('year-results');
        document.getElementById('year-results').classList.remove('hidden');

        // Get phase info
        const phaseInfo = JSON.parse(localStorage.getItem('phaseInfo') || '{}');
        
        // Calculate date range for the year
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Call API based on phase count
        let data;
        if (phaseInfo.is3Phase) {
            data = await callAPI('getData3Phase', {
                startDate: startDate,
                endDate: endDate,
                solarStartHour: 6,
                solarEndHour: 18
            });
        } else {
            data = await callAPI('getPhaseData', {
                phase: 'A',
                startDate: startDate,
                endDate: endDate,
                solarStartHour: 6,
                solarEndHour: 18
            });
        }

        // Process Year analysis
        const yearResults = analyzeYear(data, phaseInfo, year);

        // Display results
        displayYearResults(yearResults, year);

    } catch (error) {
        console.error('Year Analysis error:', error);
        showAlert('error', 'เกิดข้อผิดพลาด: ' + error.message);
    }
}

// ========================================
// YEAR DATA ANALYSIS
// ========================================

function analyzeYear(apiData, phaseInfo, year) {
    let yearData = {
        year: year,
        totalEnergy: 0,
        monthlyData: [],
        dailyAvg: 0,
        monthlyAvg: 0,
        peakMonth: { month: 0, energy: 0 },
        lowestMonth: { month: 0, energy: 999999 },
        trend: 'stable' // up, down, stable
    };

    // Extract data based on phase
    let sourceData;
    if (phaseInfo.is3Phase && apiData.total) {
        sourceData = apiData.total;
    } else if (apiData.data) {
        sourceData = apiData.data;
    } else {
        throw new Error('ไม่พบข้อมูล');
    }

    // Initialize monthly data
    for (let month = 1; month <= 12; month++) {
        yearData.monthlyData.push({
            month: month,
            monthName: getThaiMonthName(month),
            energy: 0,
            days: 0,
            avgPerDay: 0
        });
    }

    // Process daily data
    if (sourceData.dailyData && sourceData.dailyData.length > 0) {
        sourceData.dailyData.forEach(record => {
            const date = new Date(record.date);
            const month = date.getMonth() + 1; // 1-12
            
            if (month >= 1 && month <= 12) {
                yearData.monthlyData[month - 1].energy += parseFloat(record.energy) || 0;
                yearData.monthlyData[month - 1].days++;
            }
        });

        // Calculate totals and averages
        yearData.monthlyData.forEach((monthData, index) => {
            yearData.totalEnergy += monthData.energy;
            
            if (monthData.days > 0) {
                monthData.avgPerDay = monthData.energy / monthData.days;
            }

            // Find peak and lowest months
            if (monthData.energy > yearData.peakMonth.energy) {
                yearData.peakMonth = {
                    month: index + 1,
                    monthName: monthData.monthName,
                    energy: monthData.energy
                };
            }

            if (monthData.energy < yearData.lowestMonth.energy && monthData.energy > 0) {
                yearData.lowestMonth = {
                    month: index + 1,
                    monthName: monthData.monthName,
                    energy: monthData.energy
                };
            }
        });

        // Calculate averages
        const daysInYear = sourceData.dailyData.length;
        if (daysInYear > 0) {
            yearData.dailyAvg = yearData.totalEnergy / daysInYear;
        }

        const monthsWithData = yearData.monthlyData.filter(m => m.energy > 0).length;
        if (monthsWithData > 0) {
            yearData.monthlyAvg = yearData.totalEnergy / monthsWithData;
        }

        // Calculate trend
        yearData.trend = calculateTrend(yearData.monthlyData);
    }

    return yearData;
}

function calculateTrend(monthlyData) {
    // Compare first 3 months vs last 3 months
    const firstQuarter = monthlyData.slice(0, 3)
        .filter(m => m.energy > 0)
        .reduce((sum, m) => sum + m.energy, 0) / 3;
    
    const lastQuarter = monthlyData.slice(-3)
        .filter(m => m.energy > 0)
        .reduce((sum, m) => sum + m.energy, 0) / 3;

    if (firstQuarter === 0 || lastQuarter === 0) {
        return 'stable';
    }

    const change = ((lastQuarter - firstQuarter) / firstQuarter) * 100;

    if (change > 10) return 'up';
    if (change < -10) return 'down';
    return 'stable';
}

function getThaiMonthName(month) {
    const months = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
        'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
        'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    return months[month - 1] || '';
}

// ========================================
// DISPLAY RESULTS
// ========================================

function displayYearResults(results, year) {
    // Display statistics
    displayYearStats(results);

    // Display monthly table
    displayMonthlyTable(results);

    // Display charts
    displayYearCharts(results);
}

function displayYearStats(results) {
    const statsDiv = document.getElementById('year-stats');
    
    const trendIcon = results.trend === 'up' ? '📈' : 
                     results.trend === 'down' ? '📉' : '➡️';
    const trendText = results.trend === 'up' ? 'เพิ่มขึ้น' : 
                     results.trend === 'down' ? 'ลดลง' : 'คงที่';
    const trendClass = results.trend === 'up' ? 'alert-warning' : 
                      results.trend === 'down' ? 'alert-success' : 'alert-info';

    statsDiv.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">พลังงานรวมทั้งปี</div>
                <div class="stat-value">${results.totalEnergy.toFixed(2)}</div>
                <div class="stat-unit">kWh</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">เฉลี่ยต่อเดือน</div>
                <div class="stat-value">${results.monthlyAvg.toFixed(2)}</div>
                <div class="stat-unit">kWh/month</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">เฉลี่ยต่อวัน</div>
                <div class="stat-value">${results.dailyAvg.toFixed(2)}</div>
                <div class="stat-unit">kWh/day</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">แนวโน้ม</div>
                <div class="stat-value">${trendIcon}</div>
                <div class="stat-unit">${trendText}</div>
            </div>
        </div>

        <div class="alert ${trendClass}" style="margin-top: 20px;">
            <h3>📊 สรุปภาพรวมปี ${results.year}</h3>
            <p><strong>เดือนที่ใช้มากที่สุด:</strong> ${results.peakMonth.monthName} (${results.peakMonth.energy.toFixed(2)} kWh)</p>
            <p><strong>เดือนที่ใช้น้อยที่สุด:</strong> ${results.lowestMonth.monthName} (${results.lowestMonth.energy.toFixed(2)} kWh)</p>
            <p><strong>แนวโน้มการใช้:</strong> ${trendIcon} ${trendText}</p>
        </div>
    `;
}

function displayMonthlyTable(results) {
    const tableDiv = document.getElementById('year-monthly-table');
    
    let html = `
        <table class="tou-table">
            <thead>
                <tr>
                    <th>เดือน</th>
                    <th>พลังงาน (kWh)</th>
                    <th>จำนวนวัน</th>
                    <th>เฉลี่ยต่อวัน (kWh)</th>
                    <th>% ของปี</th>
                </tr>
            </thead>
            <tbody>
    `;

    results.monthlyData.forEach(monthData => {
        const percent = results.totalEnergy > 0 ? 
            (monthData.energy / results.totalEnergy) * 100 : 0;

        html += `
            <tr>
                <td><strong>${monthData.monthName}</strong></td>
                <td>${monthData.energy.toFixed(2)}</td>
                <td>${monthData.days}</td>
                <td>${monthData.avgPerDay.toFixed(2)}</td>
                <td>${percent.toFixed(1)}%</td>
            </tr>
        `;
    });

    html += `
                <tr style="background-color: #f0f0f0; font-weight: bold;">
                    <td>รวมทั้งปี</td>
                    <td>${results.totalEnergy.toFixed(2)}</td>
                    <td>-</td>
                    <td>${results.dailyAvg.toFixed(2)}</td>
                    <td>100%</td>
                </tr>
            </tbody>
        </table>
    `;

    tableDiv.innerHTML = html;
}

function displayYearCharts(results) {
    // Chart 1: Monthly Energy
    const monthLabels = results.monthlyData.map(m => m.monthName);
    const monthValues = results.monthlyData.map(m => m.energy);

    createBarChart('year-monthly-chart',
        monthLabels,
        [{
            label: 'พลังงาน (kWh)',
            data: monthValues,
            backgroundColor: '#667eea'
        }],
        'การใช้ไฟฟ้ารายเดือน'
    );

    // Chart 2: Monthly Average per Day
    const avgPerDayValues = results.monthlyData.map(m => m.avgPerDay);

    createLineChart('year-avg-chart',
        monthLabels,
        [{
            label: 'เฉลี่ยต่อวัน (kWh)',
            data: avgPerDayValues,
            borderColor: '#ffc107',
            backgroundColor: 'rgba(255, 193, 7, 0.1)',
            tension: 0.4
        }],
        'ค่าเฉลี่ยต่อวันรายเดือน'
    );

    // Chart 3: Percentage Distribution
    createPieChart('year-distribution-chart',
        monthLabels,
        monthValues,
        'การกระจายการใช้ไฟฟ้ารายเดือน'
    );

    // Chart 4: Comparison with Average
    const avgLine = Array(12).fill(results.monthlyAvg);
    
    createLineChart('year-comparison-chart',
        monthLabels,
        [
            {
                label: 'การใช้จริง (kWh)',
                data: monthValues,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            },
            {
                label: 'ค่าเฉลี่ย (kWh)',
                data: avgLine,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                borderDash: [5, 5],
                tension: 0
            }
        ],
        'เปรียบเทียบกับค่าเฉลี่ย'
    );
}

// ========================================
// YEAR SELECTOR
// ========================================

function populateYearSelector() {
    const select = document.getElementById('year-select');
    if (!select) return;
    
    const currentYear = new Date().getFullYear();
    
    // Clear existing options
    select.innerHTML = '';
    
    // Add years from 2020 to current year
    for (let year = currentYear; year >= 2020; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year + 543; // Buddhist year
        if (year === currentYear) {
            option.selected = true;
        }
        select.appendChild(option);
    }
}

function populateCompareYearSelectors() {
    const select1 = document.getElementById('compare-year1');
    const select2 = document.getElementById('compare-year2');
    
    if (!select1 || !select2) return;
    
    const currentYear = new Date().getFullYear();
    
    // Clear existing options
    select1.innerHTML = '';
    select2.innerHTML = '';
    
    // Add years from 2020 to current year
    for (let year = currentYear; year >= 2020; year--) {
        const option1 = document.createElement('option');
        option1.value = year;
        option1.textContent = year + 543; // Buddhist year
        
        const option2 = document.createElement('option');
        option2.value = year;
        option2.textContent = year + 543;
        
        // Select current year for first selector
        if (year === currentYear) {
            option1.selected = true;
        }
        
        // Select previous year for second selector
        if (year === currentYear - 1) {
            option2.selected = true;
        }
        
        select1.appendChild(option1);
        select2.appendChild(option2);
    }
}

// Initialize year selectors on page load
if (document.getElementById('year-select')) {
    populateYearSelector();
    populateCompareYearSelectors();
}

// ========================================
// COMPARISON YEARS
// ========================================

async function compareYears() {
    try {
        const year1 = parseInt(document.getElementById('compare-year1').value);
        const year2 = parseInt(document.getElementById('compare-year2').value);

        if (!year1 || !year2) {
            showAlert('error', 'กรุณาเลือกปีที่ต้องการเปรียบเทียบ');
            return;
        }

        if (year1 === year2) {
            showAlert('error', 'กรุณาเลือกปีที่แตกต่างกัน');
            return;
        }

        showLoading('compare-results');
        document.getElementById('compare-results').classList.remove('hidden');

        // Get data for both years
        const phaseInfo = JSON.parse(localStorage.getItem('phaseInfo') || '{}');
        
        const data1 = await getYearData(year1, phaseInfo);
        const data2 = await getYearData(year2, phaseInfo);

        const results1 = analyzeYear(data1, phaseInfo, year1);
        const results2 = analyzeYear(data2, phaseInfo, year2);

        // Display comparison
        displayYearComparison(results1, results2);

    } catch (error) {
        console.error('Compare years error:', error);
        showAlert('error', 'เกิดข้อผิดพลาด: ' + error.message);
    }
}

async function getYearData(year, phaseInfo) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    if (phaseInfo.is3Phase) {
        return await callAPI('getData3Phase', {
            startDate: startDate,
            endDate: endDate,
            solarStartHour: 6,
            solarEndHour: 18
        });
    } else {
        return await callAPI('getPhaseData', {
            phase: 'A',
            startDate: startDate,
            endDate: endDate,
            solarStartHour: 6,
            solarEndHour: 18
        });
    }
}

function displayYearComparison(results1, results2) {
    const container = document.getElementById('compare-results');
    
    const diff = results2.totalEnergy - results1.totalEnergy;
    const percentChange = results1.totalEnergy > 0 ? 
        ((diff / results1.totalEnergy) * 100).toFixed(1) : 0;
    
    const changeIcon = diff > 0 ? '📈' : diff < 0 ? '📉' : '➡️';
    const changeText = diff > 0 ? 'เพิ่มขึ้น' : diff < 0 ? 'ลดลง' : 'คงที่';
    const changeClass = diff > 0 ? 'alert-warning' : 
                       diff < 0 ? 'alert-success' : 'alert-info';

    container.innerHTML = `
        <div class="section-title">📊 เปรียบเทียบปี ${results1.year} vs ${results2.year}</div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">ปี ${results1.year}</div>
                <div class="stat-value">${results1.totalEnergy.toFixed(0)}</div>
                <div class="stat-unit">kWh</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">ปี ${results2.year}</div>
                <div class="stat-value">${results2.totalEnergy.toFixed(0)}</div>
                <div class="stat-unit">kWh</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">ความแตกต่าง</div>
                <div class="stat-value">${changeIcon}</div>
                <div class="stat-unit">${Math.abs(diff).toFixed(0)} kWh</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">เปลี่ยนแปลง</div>
                <div class="stat-value">${percentChange}%</div>
                <div class="stat-unit">${changeText}</div>
            </div>
        </div>

        <div class="alert ${changeClass}">
            <strong>${changeIcon} ${changeText} ${percentChange}%</strong><br>
            จากปี ${results1.year} ไปยังปี ${results2.year} 
            มีการใช้ไฟฟ้า${changeText} ${Math.abs(diff).toFixed(2)} kWh
        </div>

        <div class="chart-container">
            <canvas id="year-compare-chart"></canvas>
        </div>
    `;

    // Create comparison chart
    const monthLabels = results1.monthlyData.map(m => m.monthName);
    
    createLineChart('year-compare-chart',
        monthLabels,
        [
            {
                label: `ปี ${results1.year}`,
                data: results1.monthlyData.map(m => m.energy),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            },
            {
                label: `ปี ${results2.year}`,
                data: results2.monthlyData.map(m => m.energy),
                borderColor: '#ffc107',
                backgroundColor: 'rgba(255, 193, 7, 0.1)',
                tension: 0.4
            }
        ],
        'เปรียบเทียบการใช้ไฟฟ้ารายเดือน'
    );
}

// ========================================
// EXPORT
// ========================================

window.loadYearData = loadYearData;
window.compareYears = compareYears;
window.populateYearSelector = populateYearSelector;
window.populateCompareYearSelectors = populateCompareYearSelectors;
