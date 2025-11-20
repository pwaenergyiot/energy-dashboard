// ========================================
// EMAIL REPORT
// ========================================

// Send Email Report Function
async function sendEmailReport() {
    try {
        // Get settings
        const recipient = document.getElementById('email-recipient').value;
        const startDate = document.getElementById('email-startDate').value;
        const endDate = document.getElementById('email-endDate').value;

        if (!recipient) {
            showAlert('error', 'กรุณากรอกอีเมลผู้รับ');
            return;
        }

        if (!startDate || !endDate) {
            showAlert('error', 'กรุณาเลือกวันที่');
            return;
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipient)) {
            showAlert('error', 'รูปแบบอีเมลไม่ถูกต้อง');
            return;
        }

        // Show loading
        const resultDiv = document.getElementById('email-result');
        resultDiv.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>กำลังสร้างและส่งรายงาน...</p>
                <p style="font-size: 0.9em; color: #666;">กรุณารอสักครู่ อาจใช้เวลา 30-60 วินาที</p>
            </div>
        `;

        // Call API to send report
        const data = await callAPI('sendReport', {
            recipientEmail: recipient,
            startDate: startDate,
            endDate: endDate
        });

        // Show success message
        resultDiv.innerHTML = `
            <div class="section">
                <div class="alert alert-success">
                    <h3>✅ ส่งรายงานสำเร็จ!</h3>
                    <p><strong>ผู้รับ:</strong> ${recipient}</p>
                    <p><strong>ช่วงเวลา:</strong> ${startDate} ถึง ${endDate}</p>
                    <p><strong>เวลาที่ส่ง:</strong> ${new Date().toLocaleString('th-TH')}</p>
                    <br>
                    <p>📧 กรุณาตรวจสอบอีเมลของคุณ</p>
                    <p style="font-size: 0.9em; color: #666;">
                        รายงานจะประกอบด้วย:<br>
                        • สรุปการใช้ไฟฟ้ารวม<br>
                        • TOU Cost Analysis<br>
                        • Solar Period Analysis<br>
                        • ไฟล์ Excel แนบ
                    </p>
                </div>
            </div>
        `;

        showAlert('success', 'ส่งรายงานสำเร็จ!');

    } catch (error) {
        console.error('Send email error:', error);
        
        const resultDiv = document.getElementById('email-result');
        resultDiv.innerHTML = `
            <div class="section">
                <div class="alert alert-error">
                    <h3>❌ ไม่สามารถส่งรายงานได้</h3>
                    <p><strong>ข้อผิดพลาด:</strong> ${error.message}</p>
                    <br>
                    <p>กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ</p>
                </div>
            </div>
        `;

        showAlert('error', 'เกิดข้อผิดพลาด: ' + error.message);
    }
}

// ========================================
// PREVIEW REPORT (Optional)
// ========================================

async function previewReport() {
    try {
        const startDate = document.getElementById('email-startDate').value;
        const endDate = document.getElementById('email-endDate').value;

        if (!startDate || !endDate) {
            showAlert('error', 'กรุณาเลือกวันที่');
            return;
        }

        // Get phase info
        const phaseInfo = JSON.parse(localStorage.getItem('phaseInfo') || '{}');
        
        // Call API to get data
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

        // Generate preview
        const preview = generateReportPreview(data, phaseInfo, { startDate, endDate });
        
        // Display preview
        const resultDiv = document.getElementById('email-result');
        resultDiv.innerHTML = `
            <div class="section">
                <div class="section-title">📋 ตัวอย่างรายงาน</div>
                ${preview}
            </div>
        `;

    } catch (error) {
        console.error('Preview report error:', error);
        showAlert('error', 'เกิดข้อผิดพลาด: ' + error.message);
    }
}

function generateReportPreview(data, phaseInfo, settings) {
    let totalEnergy = 0;
    let solarEnergy = 0;

    if (phaseInfo.is3Phase && data.total) {
        totalEnergy = data.total.totalEnergy || 0;
        solarEnergy = data.total.solarData?.totalSolar || 0;
    } else if (data.data) {
        totalEnergy = data.data.totalEnergy || 0;
        solarEnergy = data.data.solarData?.totalSolar || 0;
    }

    return `
        <div class="alert alert-info">
            <h3>⚡ Energy Report</h3>
            <p><strong>Period:</strong> ${settings.startDate} to ${settings.endDate}</p>
            <p><strong>System:</strong> ${phaseInfo.is3Phase ? '3-Phase' : '1-Phase'}</p>
            <br>
            <p><strong>Total Energy:</strong> ${totalEnergy.toFixed(2)} kWh</p>
            <p><strong>Solar Period Energy:</strong> ${solarEnergy.toFixed(2)} kWh</p>
            <p><strong>Solar Period %:</strong> ${totalEnergy > 0 ? ((solarEnergy / totalEnergy) * 100).toFixed(1) : 0}%</p>
            <br>
            <p style="font-size: 0.9em; color: #666;">
                📧 รายงานฉบับเต็มจะถูกส่งไปยังอีเมลพร้อมไฟล์ Excel แนบ
            </p>
        </div>
    `;
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function validateEmailForm() {
    const recipient = document.getElementById('email-recipient').value;
    const startDate = document.getElementById('email-startDate').value;
    const endDate = document.getElementById('email-endDate').value;

    if (!recipient || !startDate || !endDate) {
        return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(recipient);
}

function clearEmailResult() {
    document.getElementById('email-result').innerHTML = '';
}

// ========================================
// AUTO-FILL USER EMAIL (Optional)
// ========================================

firebase.auth().onAuthStateChanged((user) => {
    if (user && user.email) {
        const recipientInput = document.getElementById('email-recipient');
        if (recipientInput && !recipientInput.value) {
            recipientInput.value = user.email;
        }
    }
});

// ========================================
// EXPORT
// ========================================

window.sendEmailReport = sendEmailReport;
window.previewReport = previewReport;
