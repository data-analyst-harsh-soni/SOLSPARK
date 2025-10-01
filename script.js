const myVisualImages = ['gen1.jpg', 'gen2.jpg', 'gen3.jpg', 'gen4.jpg', 'gen5.jpg'];
const myAiVideos = ['explainer1.mp4', 'explainer2.mp4', 'explainer3.mp4', 'explainer4.mp4'];
let map, communityMap, drawnItems, drawControl, chart, pollutionChart, lastCalc, communityData = [],
    locationDetected = false,
    currentLanguage = 'en',
    detectedLat = null,
    detectedLon = null;


const NASA_TOKEN = "i4Vjou3u6oUk3dmcGGDixhSIviXGPDB6pR7gTY0H";
function initCalculatorMobileFixes() {
    
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        const inputs = document.querySelectorAll('.calculator-section input, .calculator-section select, .calculator-section textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.style.fontSize = '16px';
            });
            input.addEventListener('blur', function() {
                this.style.fontSize = '';
            });
        });
    }
    

    function adjustCalculatorLayout() {
        const calculatorSection = document.querySelector('.calculator-section');
        if (calculatorSection && window.innerWidth <= 768) {
            calculatorSection.style.minHeight = 'auto';
            calculatorSection.style.padding = '2rem 1rem';
            
            
            const inputs = calculatorSection.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.style.width = '100%';
                input.style.maxWidth = '100%';
            });
            
            const buttonGroups = calculatorSection.querySelectorAll('.button-group');
            buttonGroups.forEach(group => {
                group.style.flexDirection = 'column';
            });
            
            const rows = calculatorSection.querySelectorAll('.row');
            rows.forEach(row => {
                row.style.flexDirection = 'column';
            });
        }
    }
    
    window.addEventListener('resize', adjustCalculatorLayout);
    window.addEventListener('load', adjustCalculatorLayout);
    adjustCalculatorLayout();
}


async function getNasaSolarData(lat, lon) {
    const weatherInfoEl = document.getElementById("weather-info");
    if (weatherInfoEl) {
        weatherInfoEl.style.display = 'block';
        weatherInfoEl.textContent = translations['nasa_fetching'][currentLanguage];
    }
    
    const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`NASA Error: ${res.status}`);
        const data = await res.json();

        const insolationData = data.properties.parameter.ALLSKY_SFC_SW_DWN;
        const avgInsolation = insolationData.ANN;

        if (avgInsolation > 0) {
            if (weatherInfoEl) {
                weatherInfoEl.textContent = `☀️ NASA Data (Avg. Annual): ${avgInsolation.toFixed(2)} kWh/m²/day.`;
            }
            return { avgInsolation };
        }
        
        throw new Error('Invalid NASA data or ANN value is zero');

    } catch (e) {
        console.error("NASA Data Fetch Error (Using Climatology):", e);
        if (weatherInfoEl) {
            weatherInfoEl.textContent = translations['nasa_unavailable'][currentLanguage];
        }
        return { avgInsolation: 4.5 };
    }
}

async function getNasaAirQuality(lat, lon, city) {
    const aqiContainer = document.getElementById('aqi-container');
    const aqiEl = document.getElementById('aqi-results');
    
    if (aqiContainer) aqiContainer.style.display = 'block';
    if (aqiEl) aqiEl.innerHTML = `<p>${translations['nasa_fetching_aqi'][currentLanguage]}</p>`;

    try {
        const isHighPollutionArea = (lat > 20 && lat < 30) && (lon > 75 && lon < 85);
        
        let no2Concentration = isHighPollutionArea ? Math.random() * (50 - 30) + 30 : Math.random() * (20 - 5) + 5;
        
        let conceptualAqi = Math.round(no2Concentration * 3);
        
        if (conceptualAqi > 0) {
            return {
                aqi: conceptualAqi,
                city: city,
                source: "NASA TEMPO/OMPS (Simulated Data)"
            };
        }
        
        throw new Error('Invalid simulated Air Quality data');

    } catch (e) {
        console.error("NASA Air Quality Fetch Error:", e);
        return { aqi: 120, city: city, source: "Default Estimate" };
    }
}

async function getNasaLSTData(lat, lon) {
    
    try {
        
        const isMajorCity = Math.abs(lat - 23.16) < 0.2 && Math.abs(lon - 79.93) < 0.2;
        
        let avgLST;
        if (isMajorCity) {
            avgLST = Math.random() * (325 - 310) + 310;
        } else {
            avgLST = Math.random() * (315 - 300) + 300;
        }

        return { avgLST: avgLST.toFixed(1), isHighUHI: isMajorCity };
    } catch (e) {
        console.error("NASA LST Fetch Error:", e);
        return { avgLST: 'N/A', isHighUHI: true };
    }
}

async function getAddress(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Geo Error: ${res.status}`);
        const data = await res.json();
        
        return data.display_name;
    } catch (e) {
        console.error("Address Fetch Error:", e);
        return "Unknown Location";
    }
}

function showSectionWithoutPush(targetId) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    const target = document.querySelector(targetId);
    
    if (target) {
        target.classList.add('active');
        if (targetId === '#dashboard') renderDashboard();
        if (targetId === '#solar-panels') renderSolarPanels();
        if (targetId === '#maintenance') {
            updateMaintenanceTips();
            renderMaintenanceChecklist();
        }
        if (targetId === '#calculator') {
            setTimeout(initCalculatorMobileFixes, 100);
        }
    }
}

function showSection(targetId) {
    if (window.location.hash !== targetId) {
        history.pushState({ section: targetId }, targetId, targetId);
    }
    showSectionWithoutPush(targetId);
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('login-container').style.display = 'flex';
    initializeMaps();
    changeLanguage('en');
    setupEventListeners();

    const capacitySelector = document.getElementById('system-capacity-selector');
    if (capacitySelector) {
        capacitySelector.value = 'small';
        updateMaintenanceTips();
        renderMaintenanceChecklist();
    }
    
    if (window.location.hash) {
        showSectionWithoutPush(window.location.hash);
    } else {
        showSectionWithoutPush('#home');
    }
});

window.addEventListener('popstate', function(event) {
    if (event.state && event.state.section) {
        showSectionWithoutPush(event.state.section);
    } else {
        showSectionWithoutPush('#home');
    }
});


function initializeMaps() {
    try {
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
        map = L.map('map', { layers: [satelliteLayer] }).setView([23.1815, 79.9864], 12);
        L.control.layers({ "Satellite": satelliteLayer, "Street View": osmLayer }).addTo(map);
        drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawControl = new L.Control.Draw({
            edit: { featureGroup: drawnItems },
            draw: { polygon: false, polyline: false, circle: false, marker: false, circlemarker: false, rectangle: { shapeOptions: { color: '#ffc857' } } }
        });
        map.addControl(drawControl);
        map.on(L.Draw.Event.CREATED, function(event) {
            const layer = event.layer;
            drawnItems.clearLayers();
            drawnItems.addLayer(layer);
            const areaInSqFt = (L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]) * 10.7639).toFixed(0);
            document.getElementById("roofArea").value = areaInSqFt;
            showMessage(`Roof area selected: ${areaInSqFt} sq ft`, 'success');
        });
        communityMap = L.map('communityMap').setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(communityMap);
        autoDetectLocation();
    } catch (e) {
        console.error("Map initialization failed:", e);
    }
}

function setupEventListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-target');
            showSection(targetId);
            document.getElementById('navMenu').classList.remove('active');
        });
    });
    document.getElementById('navToggle').addEventListener('click', () => { document.getElementById('navMenu').classList.toggle('active'); });
    document.querySelector('.contact-form').addEventListener('submit', (e) => {
        e.preventDefault();
        showMessage(translations['message_sent_success'][currentLanguage], 'success');
        e.target.reset();
    });
    document.getElementById('addressInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') getLocation(); });
    document.getElementById('langSelect').addEventListener('change', (e) => { changeLanguage(e.target.value); });

    const maintenanceForm = document.getElementById('monthly-maintenance-form');
    if (maintenanceForm) {
        maintenanceForm.addEventListener('submit', handleMaintenanceForm);
    }
    
    const calculatorSection = document.querySelector('.calculator-section');
    if (calculatorSection) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (mutation.target.classList.contains('calculator-section') &&
                        mutation.target.classList.contains('active')) {
                        setTimeout(initCalculatorMobileFixes, 100);
                    }
                }
            });
        });
        observer.observe(calculatorSection, { attributes: true });
    }
}

function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    if (username === 'nasa' && password === '1234') {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        showSection('#home');
    } else {
        showMessage(translations['invalid_login'][currentLanguage], 'error');
    }
}

async function calculate() {
    showMessage(translations['calculating_solar'][currentLanguage]);
    
    const bill = parseFloat(document.getElementById("bill").value);
    const tariff = parseFloat(document.getElementById("tariff").value);
    const annualUnitsInput = parseFloat(document.getElementById("annualUnits").value);
    let monthlyUnits;

    if (!isNaN(annualUnitsInput) && annualUnitsInput > 0) {
        monthlyUnits = annualUnitsInput / 12;
    }
    else if (!isNaN(bill) && bill > 0 && !isNaN(tariff) && tariff > 0) {
        monthlyUnits = bill / tariff;
    }
    else {
        showMessage(translations['invalid_input'][currentLanguage], "error");
        return;
    }

    const panelType = document.getElementById("panelTypeSelect").value;
    let costPerKw;
    if (panelType === 'MONO') {
        costPerKw = 65000;
    } else if (panelType === 'POLY') {
        costPerKw = 55000;
    } else {
        costPerKw = 60000;
    }

    const budget = parseFloat(document.getElementById("budget").value) || Infinity;
    const roofArea = parseFloat(document.getElementById("roofArea").value) || Infinity;
    const monthlyIncome = parseFloat(document.getElementById("monthlyIncome").value) || 0;
    const state = document.getElementById("stateSelect").value;
    const bank = document.getElementById("bankSelect").value;

    const locationData = await getLocation();
    if (!locationData) {
        showMessage(translations['location_not_found'][currentLanguage], 'error');
        return;
    }
    
    const addressText = document.getElementById('addressInput').value || 'Detected Location';

    const solarData = await getNasaSolarData(locationData.lat, locationData.lon);
    const aqiData = await getNasaAirQuality(locationData.lat, locationData.lon, addressText); // Passed address
    const lstData = await getNasaLSTData(locationData.lat, locationData.lon);

    let requiredKw = (monthlyUnits / (solarData.avgInsolation * 30));

    if (roofArea !== Infinity && roofArea > 0) {
        const maxKwFromRoof = (roofArea / (panelType === 'MONO' ? 80 : 100));
        if (requiredKw > maxKwFromRoof) {
            requiredKw = maxKwFromRoof;
            showMessage(translations['system_size_adjusted_roof'][currentLanguage], 'success');
        }
    }

    let installCost = (requiredKw * costPerKw);

    if (installCost > budget) {
        requiredKw = (budget / costPerKw);
        installCost = budget;
        showMessage(translations['system_size_adjusted_budget'][currentLanguage], 'success');
    }

    const monthlySavings = (monthlyUnits * tariff * 0.9);
    const payback = (monthlySavings > 0) ? (installCost / (monthlySavings * 12)) : "N/A";
    const co2 = (requiredKw * 1.5);
    const trees = Math.round(co2 * 45);

    const subsidyInfo = checkSubsidyEligibility(state, monthlyIncome, bill, requiredKw, installCost);
    const finalCostAfterSubsidy = installCost - subsidyInfo.subsidyAmount;
    const loanInfo = getLoanInfo(bank, finalCostAfterSubsidy);

    lastCalc = {
        bill, requiredKw: requiredKw.toFixed(2), installCost: installCost.toFixed(0), monthlySavings: monthlySavings.toFixed(0),
        payback: payback !== "N/A" ? payback.toFixed(1) : payback, co2: co2.toFixed(1), trees, aqiData, lstData,
        subsidyInfo, loanInfo, finalCostAfterSubsidy: finalCostAfterSubsidy.toFixed(0)
    };
    
    const oldUhiTip = document.querySelector('.result-stat-card[style*="grid-column: 1 / -1"]');
    if(oldUhiTip) oldUhiTip.remove();

    displayResults(lastCalc);
    displaySubsidyResults(subsidyInfo, installCost, loanInfo);
    updateGamificationResults(lastCalc);
    // **This is where the location data is saved to communityData**
    updateCommunityData({ co2: parseFloat(lastCalc.co2), trees, lat: locationData.lat, lon: locationData.lon });
    displayAqiResults(aqiData);
    displayUhiTip(lstData);
    changeLanguage(currentLanguage);
}

const scripts = {
    en: (data) => `Hello! Based on your bill of ₹${data.bill}, you'll need an approximate ${data.requiredKw} kilowatt solar system. The estimated cost will be ₹${data.installCost}. You'll save around ₹${data.monthlySavings} per month, and the payback period is ${data.payback} years. This is equivalent to saving ${data.co2} tons of carbon dioxide, which is like planting ${data.trees} trees.`,
    hi: (data) => {
        let script = `नमस्ते! आपके ₹${data.bill} के बिल के आधार पर, आपको लगभग ${data.requiredKw} किलोवाट का सोलर सिस्टम चाहिए। `;
        script += `इसका अनुमानित खर्च ₹${data.installCost} होगा। आप हर महीने लगभग ₹${data.monthlySavings} बचाएंगे `;
        script += `और आपका पैसा ${data.payback} साल में वसूल हो जाएगा। `;
        script += `यह ${data.co2} टन कार्बन डाइऑक्साइड बचाने के बराबर है, जो ${data.trees} पेड़ लगाने जैसा है।`;
        return script;
    }
};

function generateAI() {
    if (!lastCalc) {
        showMessage(translations['explainer_generate_first_message'][currentLanguage], 'error');
        return;
    }
    const scriptText = scripts[currentLanguage](lastCalc);
    document.getElementById('anim-main').textContent = scriptText;
    showSection('#ai-explainer');
    showMessage(translations['explainer_generated_message'][currentLanguage], 'success');
}

function playSpeech() {
    const text = document.getElementById('anim-main').textContent;
    if (!text || text.includes(translations['explainer_placeholder'][currentLanguage])) {
        showMessage(translations['explainer_generate_first_message'][currentLanguage], "error");
        return;
    }
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = currentLanguage === 'hi' ? 'hi-IN' : 'en-US';
    if (currentLanguage === 'hi') {
        const hindiVoice = speechSynthesis.getVoices().find(voice => voice.lang.includes('hi') || voice.name.includes('Hindi'));
        if (hindiVoice) {
            utterance.voice = hindiVoice;
        } else {
            console.warn("Hindi voice not found. Falling back to default.");
        }
    }
    speechSynthesis.speak(utterance);
}

function pauseSpeech() {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
}

async function autoDetectLocation() {
    if (locationDetected) return;
    locationDetected = true;
    showMessage(translations['location_detecting'][currentLanguage]);
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                map.setView([latitude, longitude], 18);
                detectedLat = latitude;
                detectedLon = longitude;
                try {
                    const address = await getAddress(latitude, longitude);
                    document.getElementById('addressInput').value = address;
                    showMessage(translations['location_gps_success'][currentLanguage], 'success');
                    addMarker([latitude, longitude], address);
                } catch (e) {
                    showMessage(translations['location_gps_fail'][currentLanguage], 'warning');
                    addMarker([latitude, longitude], translations['location_detected_label'][currentLanguage]);
                }
            },
            async () => {
                showMessage(translations['location_ip_try'][currentLanguage]);
                try {
                    const response = await fetch('https://ipapi.co/json/');
                    const data = await response.json();
                    if (data.latitude && data.longitude) {
                        map.setView([data.latitude, data.longitude], 12);
                        document.getElementById('addressInput').value = `${data.city}, ${data.region}`;
                        detectedLat = data.latitude;
                        detectedLon = data.longitude;
                        showMessage(translations['location_ip_success'][currentLanguage].replace('{city}', data.city), 'success');
                        addMarker([data.latitude, data.longitude], translations['location_approximate_label'][currentLanguage].replace('{city}', data.city));
                    } else {
                        showMessage(translations['location_autodetect_fail'][currentLanguage], 'error');
                    }
                } catch (ipErr) {
                    showMessage(translations['location_autodetect_fail'][currentLanguage], 'error');
                }
            }
        );
    } else {
        showMessage(translations['location_not_supported'][currentLanguage], "error");
    }
}

function addMarker(latlng, title) {
    if (map) {
        if (map.marker) {
            map.removeLayer(map.marker);
        }
        map.marker = L.marker(latlng).addTo(map);
        map.marker.bindPopup(title).openPopup();
    }
}

async function getLocation() {
    const addressText = document.getElementById('addressInput').value;
    if (addressText.length > 0 && detectedLat && detectedLon && addressText.includes('Chhindwara')) {
        return { lat: detectedLat, lon: detectedLon };
    }
    if (addressText.length > 0) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressText)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const loc = data[0];
                map.setView([loc.lat, loc.lon], 16);
                addMarker([loc.lat, loc.lon], loc.display_name);
                return { lat: parseFloat(loc.lat), lon: parseFloat(loc.lon) };
            } else {
                showMessage(translations['location_address_not_found'][currentLanguage], "error");
                return null;
            }
        } catch (e) {
            console.error("Geocoding Error:", e);
            return null;
        }
    } else {
        showMessage(translations['location_prompt'][currentLanguage], "error");
        return null;
    }
}

function showMessage(message, type = '') {
    const box = document.getElementById('messageBox');
    box.textContent = message;
    box.className = 'message-box';
    if (type) box.classList.add(type);
    box.classList.add('show');
    setTimeout(() => { box.classList.remove('show'); }, 4000);
}

function resetAll() {
    document.getElementById("bill").value = 2000;
    document.getElementById("budget").value = "";
    document.getElementById("roofArea").value = "";
    document.getElementById("addressInput").value = "";
    document.getElementById("results").style.display = "none";
    document.getElementById("subsidy-results").style.display = "none";
    document.getElementById("gamification-results").style.display = "none";
    document.getElementById("weather-info").style.display = "none";
    document.getElementById("emi-title").style.display = "none";
    document.getElementById("pollution-title").style.display = "none";
    document.querySelectorAll('.chart-container').forEach(c => c.style.display = 'none');
    
    const uhiTip = document.querySelector('.result-stat-card[style*="grid-column: 1 / -1"]');
    if(uhiTip) uhiTip.remove();
    
    if (chart) chart.destroy();
    if (pollutionChart) pollutionChart.destroy();
    drawnItems.clearLayers();
    showMessage(translations['reset_message'][currentLanguage], 'success');
}

function displayResults(data) {
    document.getElementById("results").style.display = "grid";
    document.getElementById("results").innerHTML = `<div class="result-stat-card"><h3>${data.requiredKw} kW</h3><p>${translations['size_label'][currentLanguage]}</p></div><div class="result-stat-card"><h3>₹${data.installCost}</h3><p>${translations['cost_label'][currentLanguage]}</p></div><div class="result-stat-card"><h3>₹${data.monthlySavings}</h3><p>${translations['savings_label'][currentLanguage]}</p></div><div class="result-stat-card"><h3>${data.payback} yrs</h3><p>${translations['payback_label'][currentLanguage]}</p></div><div class="result-stat-card"><h3>${data.co2} t/yr</h3><p>${translations['co2_label'][currentLanguage]}</p></div><div class="result-stat-card"><h3>${data.trees}</h3><p>${translations['trees_label'][currentLanguage]}</p></div>`;

    const oldUhiTip = document.querySelector('.result-stat-card[style*="grid-column: 1 / -1"]');
    if(oldUhiTip) oldUhiTip.remove();

    const emiChartEl = document.getElementById("emiChart");
    const emiTitleEl = document.getElementById("emi-title");

    if (emiChartEl && emiTitleEl) {
        emiTitleEl.style.display = 'block';
        emiChartEl.parentElement.style.display = 'block';

        if (chart) chart.destroy();

        chart = new Chart(emiChartEl.getContext("2d"), {
            type: "bar",
            data: {
                labels: [translations['emi_label_12'][currentLanguage], translations['emi_label_24'][currentLanguage], translations['emi_label_36'][currentLanguage]],
                datasets: [{
                    label: translations['monthly_payment_label'][currentLanguage],
                    data: [(data.finalCostAfterSubsidy / 12).toFixed(0), (data.finalCostAfterSubsidy / 24).toFixed(0), (data.finalCostAfterSubsidy / 36).toFixed(0)],
                    backgroundColor: ["#ff9d00", "#00c6ff", "#0072ff"]
                }]
            }
        });
    }

    if (data.aqiData && data.aqiData.aqi) {
        displayPollutionChart(data.aqiData.aqi, data.co2);
    }
}

function displayUhiTip(lstData) {
    
    let uhiTipHtml = '';
    if (lstData.isHighUHI) {
        uhiTipHtml = `<div class="result-stat-card" style="grid-column: 1 / -1; background-color: #ff3860; color: white; margin-top: 1.5rem;">
            <h3>🌡️ ${translations['uhi_tip_title'][currentLanguage]} (NASA LST: ${lstData.avgLST}K)</h3>
            <p>${translations['uhi_tip_high'][currentLanguage]}</p>
        </div>`;
    } else {
        uhiTipHtml = `<div class="result-stat-card" style="grid-column: 1 / -1; background-color: #23d160; color: white; margin-top: 1.5rem;">
            <h3>🌳 ${translations['uhi_tip_title'][currentLanguage]} (NASA LST: ${lstData.avgLST}K)</h3>
            <p>${translations['uhi_tip_low'][currentLanguage]}</p>
        </div>`;
    }
    
    const resultsGrid = document.getElementById("results");
    if (resultsGrid) {
        
        if(resultsGrid.style.display === "grid") {
            resultsGrid.insertAdjacentHTML('afterend', uhiTipHtml);
        }
    }
}

function displayPollutionChart(aqi, co2Saved) {
    const pollutionChartEl = document.getElementById("pollutionChart");
    const pollutionTitleEl = document.getElementById("pollution-title");

    if (pollutionChartEl && pollutionTitleEl) {
        pollutionTitleEl.style.display = 'block';
        pollutionChartEl.parentElement.style.display = 'block';

        const aqiReduction = co2Saved * 5;
        const newAqi = Math.max(0, (aqi - aqiReduction));

        if (pollutionChart) pollutionChart.destroy();

        pollutionChart = new Chart(pollutionChartEl.getContext("2d"), {
            type: "doughnut",
            data: {
                labels: [translations['pollution_remaining'][currentLanguage], translations['pollution_reduced'][currentLanguage]],
                datasets: [{
                    label: translations['aqi_label'][currentLanguage],
                    data: [newAqi, aqiReduction],
                    backgroundColor: ["#ff9d00", "#23d160"],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: `${translations['original_aqi'][currentLanguage]}: ${aqi}` }
                }
            }
        });
    }
}

function updateGamificationResults(data) {
    const annualKwh = data.requiredKw * 4.5 * 365;
    const roverDays = (annualKwh / 2.5).toFixed(0);
    const issSeconds = ((data.requiredKw / 120) * 3600).toFixed(0);
    const gamificationEl = document.getElementById("gamification-results");

    if (gamificationEl) {
        gamificationEl.style.display = "block";
        gamificationEl.innerHTML = `<div class="gamification-results-card"><h3>🚀 ${translations['gamification_title'][currentLanguage]}</h3><p>${translations['gamification_rover'][currentLanguage].replace('{roverDays}', roverDays)}</p><p>${translations['gamification_iss'][currentLanguage].replace('{issSeconds}', issSeconds)}</p><button class="btn" style="width:auto; margin-top:15px;" onclick="showColonistModal()">${translations['gamification_button'][currentLanguage]}</button></div>`;
        lastCalc.roverDays = roverDays; // Store for translation function
        lastCalc.issSeconds = issSeconds; // Store for translation function
    }
}

function showColonistModal() {
    if (!lastCalc) { showMessage(translations['colonist_error'][currentLanguage], 'error'); return; }

    const kw = parseFloat(lastCalc.requiredKw);

    const marsKwEl = document.getElementById('mars-kw');
    const marsBatteryEl = document.getElementById('mars-battery');
    const moonKwEl = document.getElementById('moon-kw');
    const moonBatteryEl = document.getElementById('moon-battery');

    if (marsKwEl && marsBatteryEl && moonKwEl && moonBatteryEl) {
        marsKwEl.textContent = `${(kw * 2.3).toFixed(2)} kW`;
        marsBatteryEl.textContent = `${(kw * 10 * 5).toFixed(1)} kWh`;
        moonKwEl.textContent = `${(kw * 1.1).toFixed(2)} kW`;
        moonBatteryEl.textContent = `${(kw * 10 * 20).toFixed(1)} kWh`;
    }

    const modal = document.getElementById('colonist-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeColonistModal() {
    const modal = document.getElementById('colonist-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function updateCommunityData(data) {
    // This function correctly saves the location and calculation data for the community map
    communityData.push(data);
    if (document.querySelector('#dashboard').classList.contains('active')) {
        renderDashboard();
    }
}

function renderDashboard() {
    let totalCo2 = 0, totalTrees = 0;
    communityData.forEach(item => {
        totalCo2 += item.co2;
        totalTrees += item.trees;
    });

    const totalCo2El = document.getElementById("totalCo2");
    const totalTreesEl = document.getElementById("totalTrees");
    const totalUsersEl = document.getElementById("totalUsers");

    if (totalCo2El) totalCo2El.textContent = `${totalCo2.toFixed(1)} t/yr`;
    if (totalTreesEl) totalTreesEl.textContent = totalTrees;
    if (totalUsersEl) totalUsersEl.textContent = communityData.length;

    // **MODIFICATION: Clear existing markers before redrawing ALL community points**
    // This ensures all calculations are always shown on the map correctly when rendering.
    if (communityMap) {
        communityMap.eachLayer((layer) => {
            if (layer instanceof L.CircleMarker) {
                communityMap.removeLayer(layer);
            }
        });

        communityData.forEach(item => {
            L.circleMarker([item.lat, item.lon], { radius: 8, fillColor: "#ff9d00", color: "#fff", weight: 1, opacity: 1, fillOpacity: 0.8 })
             .addTo(communityMap)
             .bindPopup(`CO₂ Saved: ${item.co2.toFixed(1)} t/yr`);
        });
    }
}

function displayAqiResults(aqiData) {
    const aqiContainer = document.getElementById('aqi-container');
    const aqiEl = document.getElementById('aqi-results');

    if (!aqiData || typeof aqiData.aqi === 'undefined' || !aqiContainer || !aqiEl) {
        if(aqiContainer) aqiContainer.style.display = 'none';
        return;
    }

    let quality = '', color = '';
    if (aqiData.aqi <= 50) { quality = translations['aqi_good'][currentLanguage]; color = '#23d160'; }
    else if (aqiData.aqi <= 100) { quality = translations['aqi_moderate'][currentLanguage]; color = '#ff9d00'; }
    else { quality = translations['aqi_unhealthy'][currentLanguage]; color = '#ff3860'; }

    // Display the location name passed to the function
    aqiEl.innerHTML = `<p style="margin-bottom: 0.5rem;"><strong>${translations['aqi_city'][currentLanguage]}:</strong> ${aqiData.city}</p><h3 style="font-size: 2.5rem; color: ${color}; margin: 0.5rem 0;">${aqiData.aqi}</h3><p style="color: ${color};"><strong>${quality}</strong></p><p class="small-text">Source: ${aqiData.source}</p>`;
    aqiContainer.style.display = 'block';
}

function displaySubsidyResults(subsidyInfo, totalCost, loanInfo) {
    const subsidyEl = document.getElementById("subsidy-results");

    if (!subsidyEl) return;

    subsidyEl.style.display = "block";

    if (!subsidyInfo.isEligible) {
        subsidyEl.innerHTML = `<div class="gamification-results-card" style="border-left: 4px solid #ff3860;"><h3>❌ ${translations['subsidy_not_eligible_title'][currentLanguage]}</h3><p>${translations['subsidy_not_eligible_desc'][currentLanguage]}</p></div>`;
    } else {
        let loanDetails = '';
        if (loanInfo.bankName !== 'NONE' && loanInfo.bankName !== translations['no_loan'][currentLanguage]) {
            const monthlyEMI = loanInfo.monthlyEMI.toFixed(0);
            loanDetails = `<p>${translations['subsidy_loan_details'][currentLanguage].replace('{bankName}', loanInfo.bankName).replace('{monthlyEMI}', monthlyEMI.toLocaleString()).replace('{loanTenure}', loanInfo.loanTenure)}</p>`;
        }

        subsidyEl.innerHTML = `<div class="gamification-results-card"><h3>💰 ${translations['subsidy_eligible_title'][currentLanguage]}</h3><p>${translations['subsidy_eligible_desc'][currentLanguage].replace('{schemeName}', subsidyInfo.schemeName)}</p><p>${translations['subsidy_amount'][currentLanguage].replace('{subsidyAmount}', subsidyInfo.subsidyAmount.toLocaleString())}</p><p>${translations['subsidy_cost_after'][currentLanguage].replace('{finalCost}', (totalCost - subsidyInfo.subsidyAmount).toLocaleString())}</p>${loanDetails}<p class="small-text">${translations['subsidy_disclaimer'][currentLanguage]}</p></div>`;
    }
}

function checkSubsidyEligibility(state, income, monthlyBill, systemSize, totalCost) {
    let subsidyAmount = 0;
    let schemeName = translations['no_scheme_found'][currentLanguage];
    let isEligible = false;

    if (monthlyBill >= 500) { isEligible = true; }
    else { return { isEligible: false, schemeName, subsidyAmount: 0 }; }

    if (systemSize <= 3) {
        subsidyAmount = systemSize * 30000;
        schemeName = "PM Surya Ghar Muft Bijli Yojana";
    } else if (systemSize > 3 && systemSize <= 10) {
        subsidyAmount = (3 * 30000) + ((systemSize - 3) * 18000);
        schemeName = "PM Surya Ghar Muft Bijli Yojana";
    } else {
        subsidyAmount = (3 * 30000) + (7 * 18000);
        schemeName = "PM Surya Ghar Muft Bijli Yojana";
    }

    subsidyAmount = Math.min(subsidyAmount, totalCost);

    return { isEligible, schemeName, subsidyAmount };
}

function getLoanInfo(bank, costAfterSubsidy) {
    if (bank === 'NONE') { return { bankName: translations['no_loan'][currentLanguage], loanAmount: 0, loanTenure: 0, monthlyEMI: 0 }; }

    let loanRate = 0, loanTenure = 5;
    const loanAmount = costAfterSubsidy;

    if (bank === 'SBI') { loanRate = 8.5; }
    else if (bank === 'HDFC') { loanRate = 9.2; }
    else if (bank === 'PNB') { loanRate = 8.8; }

    const monthlyRate = loanRate / 12 / 100;
    const numberOfMonths = loanTenure * 12;

    const monthlyEMI = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfMonths) / (Math.pow(1 + monthlyRate, numberOfMonths) - 1);

    return { bankName: bank, loanAmount, loanTenure, monthlyEMI };
}

function generateExplainerVisual() {
    if (!lastCalc) { showMessage(translations['visual_error'][currentLanguage], 'error'); return; }

    const visualEl = document.getElementById('aiVisual');
    const placeholder = document.querySelector('.ai-visual-placeholder');

    if(visualEl && placeholder) {
        const randomIndex = Math.floor(Math.random() * myVisualImages.length);
        visualEl.src = myVisualImages[randomIndex];
        placeholder.style.display = 'none';
        visualEl.style.display = 'block';
        showMessage(translations['visual_generated'][currentLanguage], 'success');
    }
}

function generateExplainerVideo() {
    if (!lastCalc) { showMessage(translations['video_error'][currentLanguage], 'error'); return; }

    const videoEl = document.getElementById('aiVideo');
    const placeholder = document.querySelector('.ai-video-placeholder');

    if(videoEl && placeholder) {
        const randomIndex = Math.floor(Math.random() * myAiVideos.length);
        videoEl.src = myAiVideos[randomIndex];
        placeholder.style.display = 'none';
        videoEl.style.display = 'block';
        videoEl.load();
        videoEl.play();
        showMessage(translations['video_generated'][currentLanguage], 'success');
    }
}

function addMessageToLog(content, type) {
    const chatLog = document.getElementById('chatLog');
    if (!chatLog) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    const sanitizedContent = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    messageDiv.innerHTML = sanitizedContent;
    chatLog.appendChild(messageDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function handleChatInput(event) {
    if (event.key === 'Enter') {
        askChatbot();
    }
}

async function askChatbot() {
    const inputEl = document.getElementById('chatInput');
    const input = inputEl.value.trim();
    if (!input) return;

    addMessageToLog(input, 'user-msg');
    inputEl.value = '';
    inputEl.disabled = true;

    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) typingIndicator.style.display = 'flex';

    const lowerCaseInput = input.toLowerCase();
    const isHindi = currentLanguage === 'hi';
    let botReply = '';

    for (const key in translations['chatbot_fallback_answers']) {
        const questionKeywords = translations['chatbot_fallback_answers'][key].keywords;
        const answer = isHindi ? translations['chatbot_fallback_answers'][key].answer_hi : translations['chatbot_fallback_answers'][key].answer_en;

        if (questionKeywords.some(keyword => lowerCaseInput.includes(keyword.toLowerCase()))) {
            botReply = answer;
            break;
        }
    }

    if (botReply) {
        await new Promise(resolve => setTimeout(resolve, 500));
        addMessageToLog(botReply, 'bot-msg');
    } else {
        await new Promise(resolve => setTimeout(resolve, 500));
        addMessageToLog(translations['chatbot_no_answer'][currentLanguage], 'bot-msg');
    }

    if (typingIndicator) typingIndicator.style.display = 'none';
    inputEl.disabled = false;
    inputEl.focus();
}

const maintenanceChecklistData = [
    { hi: "पैनल की सतह को पानी और मुलायम कपड़े से साफ किया गया? (धूल/गंदगी हटाई गई)", en: "Solar panel surfaces cleaned with water and a soft cloth? (Dust/Dirt removed)" },
    { hi: "सभी वायरिंग, केबल और जॉइंट्स को लूज/डैमेज के लिए चेक किया गया?", en: "All wiring, cables, and joints checked for looseness/damage?" },
    { hi: "इनवर्टर की स्क्रीन/इंडिकेटर लाइट्स (Errors/Status) चेक की गईं?", en: "Inverter screen/indicator lights (Errors/Status) inspected?" },
    { hi: "बैटरी का पानी स्तर (अगर है) और टर्मिनल्स साफ किए गए?", en: "Battery water level (if applicable) and terminals cleaned?" },
    { hi: "माउंटिंग स्ट्रक्चर (नट/बोल्ट) में कोई ढीलापन या जंग तो नहीं है?", en: "Mounting structure (nuts/bolts) inspected for looseness or rust?" },
    { hi: "बिजली उत्पादन (Energy Output) की रीडिंग लेकर पिछले महीने से तुलना की गई?", en: "Energy output reading taken and compared with last month?" }
];

const maintenanceCapacityTips = {
    small: {
        hi: "✅ सिर्फ सफाई और मॉनिटरिंग पर ध्यान दें। हर 15-30 दिन में पैनल साफ करें और मासिक रूप से इनवर्टर स्टेटस चेक करें।",
        en: "✅ Focus on Cleaning & Monitoring. Clean panels every 15-30 days and check the inverter status monthly."
    },
    medium: {
        hi: "✅ सफाई, वायरिंग और बैटरी पर ध्यान दें। मासिक सफाई के साथ, हर 3 महीने में वायरिंग और बैटरी की स्थिति की जाँच अवश्य करें।",
        en: "✅ Focus on Cleaning, Wiring, and Battery. Along with monthly cleaning, ensure quarterly checks of wiring and battery health."
    },
    large: {
        hi: "✅ विस्तृत जाँच, लॉगिंग और पेशेवर संपर्क। मासिक चेकलिस्ट पूरी करें और उत्पादन (Performance) का विस्तृत लॉग बनाएँ। तिमाही (Quarterly) पेशेवर निरीक्षण की सिफारिश की जाती है।",
        en: "✅ Detailed Inspection, Logging, & Professional Contact. Complete the monthly checklist and maintain a detailed performance log. Quarterly professional inspection is recommended."
    }
};

function renderMaintenanceChecklist() {
    const ul = document.getElementById('maintenance-checklist');
    if (!ul) return;
    ul.innerHTML = '';

    maintenanceChecklistData.forEach((item, index) => {
        const li = document.createElement('li');
        const text = item[currentLanguage];
        li.innerHTML = `
            <input type="checkbox" id="mcheck-${index}">
            <label for="mcheck-${index}">${text}</label>
        `;
        ul.appendChild(li);
    });
}

function updateMaintenanceTips() {
    const capacitySelector = document.getElementById('system-capacity-selector');
    const tipsP = document.getElementById('capacity-tips-text');

    if (!capacitySelector || !tipsP) return;

    const capacity = capacitySelector.value;
    tipsP.innerHTML = maintenanceCapacityTips[capacity][currentLanguage];
}

function handleMaintenanceForm(event) {
    event.preventDefault();
    const form = document.getElementById('monthly-maintenance-form');
    const checkedCount = Array.from(form.querySelectorAll('input[type="checkbox"]:checked')).length;
    const totalCount = maintenanceChecklistData.length;
    const messageP = document.getElementById('maintenance-log-message');

    let logMessage, type;

    if (checkedCount === totalCount) {
        type = 'success';
        logMessage = currentLanguage === 'hi'
            ? `👍 सभी ${totalCount} कार्य पूरे किए! आपका सिस्टम स्वस्थ है। लॉग ${new Date().toLocaleDateString()} को सहेजा गया।`
            : `👍 All ${totalCount} tasks completed! Your system is healthy. Log saved on ${new Date().toLocaleDateString()}.`;
    } else if (checkedCount > 0) {
        type = 'warning';
        logMessage = currentLanguage === 'hi'
            ? `⚠️ ${checkedCount}/${totalCount} कार्य पूरे किए गए। बाकी कार्यों को जल्द पूरा करें!`
            : `⚠️ ${checkedCount}/${totalCount} tasks completed. Please complete the remaining tasks soon!`;
    } else {
        type = 'error';
        logMessage = currentLanguage === 'hi'
            ? `❌ कोई कार्य पूरा नहीं किया गया। कृपया अपनी दक्षता सुनिश्चित करने के लिए कार्य करें।`
            : `❌ No tasks completed. Please perform the tasks to ensure your efficiency.`;
    }

    messageP.style.color = type === 'success' ? '#23d160' : type === 'warning' ? '#ff9d00' : '#ff3860';
    messageP.textContent = logMessage;

    showMessage(logMessage, type);

    setTimeout(() => {
        form.reset();
    }, 5000);
}

function getStarRatingHtml(rating) {
    const fullStar = '⭐'; // Or '&#9733;' (★)
    const emptyStar = '☆'; // Or '&#9734;' (☆)
    const maxRating = 5;
    
    // Round the rating to the nearest whole number for star count display
    const totalStars = Math.round(rating);
    let starsHtml = '';
    
    for (let i = 0; i < maxRating; i++) {
        starsHtml += (i < totalStars) ? fullStar : emptyStar;
    }
    
    return `<span style="color: gold; font-size: 1.2em; white-space: nowrap;">${starsHtml}</span> (${rating.toFixed(1)})`;
}

function renderSolarPanels() {
    const panelsData = [
        {
            company: 'Waaree Energies',
            model: 'WSM-545',
            wattage: '545W Mono-PERC',
            price: '₹22,000 - ₹25,000',
            rating: 4.8,
            link: 'https://shop.waaree.com/',
            description: {
                en: 'One of India\'s largest solar panel manufacturers, known for high-efficiency modules suitable for Indian climates.',
                hi: 'भारत की सबसे बड़ी सोलर पैनल निर्माता कंपनी में से एक, जो भारतीय जलवायु के लिए उच्च-दक्षता वाले मॉड्यूल के लिए जानी जाती है।'
            }
        },
        {
            company: 'Adani Solar',
            model: 'Alpha Series',
            wattage: '535W-550W',
            price: '₹23,000 - ₹26,000',
            rating: 4.9,
            link: 'https://www.adanisolar.com/',
            description: {
                en: 'A leader in the Indian solar industry with advanced technology and robust panel construction.',
                hi: 'भारतीय सौर उद्योग में एक प्रमुख खिलाड़ी, जो अपनी उन्नत तकनीक और मजबूत पैनल निर्माण के लिए प्रसिद्ध है।'
            }
        },
        {
            company: 'Tata Power Solar',
            model: 'Mono PERC',
            wattage: '400W-550W',
            price: '₹20,000 - ₹24,000',
            rating: 4.5,
            link: 'https://www.tatapower.com/solaroof-enquiry?utm_source=Google_Search&utm_medium=Paid&utm_campaign=TataPower_Brand_Central_Phrase-23044665828&gad_source=1&gad_campaignid=23044665828&gbraid=0AAAAAoySBgxljkZRIhqT_VuqpHftmnH50&gclid=Cj0KCQjw0NPGBhCDARIsAGAzpp2nF12rQMs1BtJ3nEODtjpKO98GuIxyfF35x68ffXwddF1-_isQ7RgaAvPYEALw_wcB',
            description: {
                en: 'A trusted name in India, offering reliable and high-performance solar solutions.',
                hi: 'भारत में एक विश्वसनीय नाम, जो टिकाऊ और उच्च-प्रदर्शन वाले सौर समाधान प्रदान करता है।'
            }
        },
        {
            company: 'Vikram Solar',
            model: 'Somera Series',
            wattage: '540W-560W',
            price: '₹22,500 - ₹25,500',
            rating: 4.4,
            link: 'https://www.solarsquare.in/rooftop-solar-in-jabalpur?utm_campaign=Y2G_PMax_Jabalpur_19Aug2024&utm_source=adwords&utm_medium=ppc&gad_source=1&gad_campaignid=21605395603&gbraid=0AAAAACamwb9LjAyugjcYRSpHG17--Gv5l&gclid=Cj0KCQjw0NPGBhCDARIsAGAzpp0U_xtIk5hmKq_K65UtSYYwPIZr0lnSxdPeihMNp1gytvTVJmtwMucaArhXEALw_wcB',
            description: {
                en: 'A globally recognized company with a strong presence in India, providing durable and efficient panels.',
                hi: 'एक विश्व स्तर पर मान्यता प्राप्त कंपनी, जिसकी भारत में मजबूत उपस्थिति है और जो कुशल और मजबूत पैनल प्रदान करती है।'
            }
        },
        {
            company: 'Loom Solar',
            model: 'Shark Bi-facial',
            wattage: '550W',
            price: '₹23,000 - ₹27,000',
            rating: 4.6,
            link: 'https://www.loomsolar.com/?srsltid=AfmBOopjw9tJqten8-ET8XYxsAExPCA404ZSR82CcYRYXw3Rj995b390',
            description: {
                en: 'Popular in the residential market for their innovative and high-efficiency bi-facial solar panels.',
                hi: 'आवासीय बाजार में अपने अभिनव और उच्च-दक्षता वाले द्विफलक (bi-facial) सौर पैनलों के लिए लोकप्रिय है।'
            }
        },
        {
            company: 'RenewSys Solar',
            model: 'Deserv',
            wattage: '540W Mono-PERC',
            price: '₹21,500 - ₹24,500',
            rating: 4.3,
            link: 'https://www.renewsysworld.com/',
            description: {
                en: 'Manufactures solar panels and other components, known for their high-quality and sustainable products.',
                hi: 'सोलर पैनल और अन्य घटकों का निर्माण करती है, जो अपने उच्च-गुणवत्ता और टिकाऊ उत्पादों के लिए जानी जाती है।'
            },
        },
        {
            company: 'Premier Energies',
            model: 'Mono-PERC',
            wattage: '545W',
            price: '₹21,000 - ₹24,000',
            rating: 4.1,
            link: 'https://www.premierenergies.com/',
            description: {
                en: 'One of the top solar panel producers in India, focusing on both residential and commercial projects.',
                hi: 'भारत में शीर्ष सौर पैनल उत्पादकों में से एक, जो आवासीय और वाणिज्यिक दोनों परियोजनाओं पर ध्यान केंद्रित करता है।'
            },
        },
        {
            company: 'Goldi Solar',
            model: 'Helios',
            wattage: '540W',
            price: '₹22,000 - ₹25,000',
            rating: 4.2,
            link: 'https://goldisolar.com/',
            description: {
                en: 'Known for producing a wide range of solar PV modules with advanced technology and high-quality materials.',
                hi: 'उन्नत तकनीक और उच्च-गुणवत्ता वाली सामग्री के साथ सौर पीवी मॉड्यूल की एक विस्तृत श्रृंखला के उत्पादन के लिए जाना जाता है।'
            },
        },
        {
            company: 'Solex Solar',
            model: 'Mono-PERC',
            wattage: '540W',
            price: '₹20,500 - ₹23,500',
            rating: 4.0,
            link: 'https://solex.in/',
            description: {
                en: 'Offers high-quality solar panels and has a strong focus on innovative and reliable solar solutions.',
                hi: 'उच्च-गुणवत्ता वाले सौर पैनल प्रदान करता है और अभिनव और विश्वसनीय सौर समाधानों पर एक मजबूत ध्यान केंद्रित करता है।'
            },
        },
        {
            company: 'Microtek Solar',
            model: 'Microtek Polycrystalline',
            wattage: '335W',
            price: '₹15,000 - ₹18,000',
            rating: 3.9,
            link: 'https://www.microtek.in/product/solar-solutions',
            description: {
                en: 'A popular brand for polycrystalline panels, providing affordable and efficient solutions for Indian homes.',
                hi: 'पॉलीक्रिस्टलाइन पैनलों के लिए एक लोकप्रिय ब्रांड, जो भारतीय घरों के लिए किफायती और कुशल समाधान प्रदान करता है।'
            },
        },
        {
            company: 'SunPower',
            model: 'Maxeon 6',
            wattage: '440W',
            price: '₹28,000 - ₹32,000',
            rating: 5.0,
            link: 'https://us.sunpower.com/',
            description: {
                en: 'A global leader in high-efficiency solar panels, offering premium performance and a long warranty.',
                hi: 'उच्च-दक्षता वाले सौर पैनलों में एक वैश्विक लीडर, जो प्रीमियम प्रदर्शन और लंबी वारंटी प्रदान करता है।'
            },
        },
        {
            company: 'Trina Solar',
            model: 'Vertex S',
            wattage: '400W',
            price: '₹18,000 - ₹21,000',
            rating: 4.5,
            link: 'https://www.trinasolar.com/us/product',
            description: {
                en: 'A top-tier global manufacturer known for innovative and highly efficient solar panels.',
                hi: 'एक टॉप-टियर वैश्विक निर्माता, जो अभिनव और अत्यधिक कुशल सौर पैनलों के लिए जाना जाता है।'
            },
        },
        {
            company: 'Jinko Solar',
            model: 'Tiger Neo',
            wattage: '545W',
            price: '₹22,000 - ₹25,000',
            rating: 4.7,
            link: 'https://www.jinkosolar.com/en/site/tigerneo_3',
            description: {
                en: 'One of the world\'s largest solar panel manufacturers, recognized for product quality and reliability.',
                hi: 'दुनिया के सबसे बड़े सौर पैनल निर्माताओं में से एक, जो उत्पाद की गुणवत्ता और विश्वसनीयता के लिए मान्यता प्राप्त है।'
            },
        },
        {
            company: 'Canadian Solar',
            model: 'HiKu7 Mono PERC',
            wattage: '665W',
            price: '₹25,000 - ₹29,000',
            rating: 4.5,
            link: 'https://www.canadiansolar.com/',
            description: {
                en: 'One of the world\'s leading solar energy companies, known for premium quality and performance.',
                hi: 'दुनिया की अग्रणी सौर ऊर्जा कंपनियों में से एक, जो प्रीमियम गुणवत्ता और प्रदर्शन के लिए जानी जाती है।'
            }
        },
        {
            company: 'Longi Solar',
            model: 'Hi-MO 5M',
            wattage: '540W',
            price: '₹21,000 - ₹24,000',
            rating: 4.7,
            link: 'https://www.longi.com/in/',
            description: {
                en: 'A global leader focused on producing high-efficiency monocrystalline solar panels.',
                hi: 'उच्च-दक्षता वाले मोनोक्रिस्टलाइन सोलर पैनलों के उत्पादन पर ध्यान केंद्रित करने वाला एक वैश्विक लीडर।'
            }
        },
    ];

    const panelListContainer = document.getElementById('panel-list');
    if (!panelListContainer) return;

    panelListContainer.innerHTML = '';

    panelsData.forEach(panel => {
        
        const starRatingHtml = getStarRatingHtml(panel.rating);
        
        const panelCard = document.createElement('div');
        panelCard.className = 'panel-card';
        panelCard.innerHTML = `
            <div class="panel-info">
                <h3>${panel.company}</h3>
                <p><strong>Rating:</strong> ${starRatingHtml}</p>
                <p><strong>Model:</strong> ${panel.model}</p>
                <p><strong>Wattage:</strong> ${panel.wattage}</p>
                <p class="price">Price: ${panel.price}</p>
                <p>${panel.description[currentLanguage]}</p>
            </div>
            <a href="${panel.link}" class="buy-link" target="_blank">${translations.buy_link_text[currentLanguage]}</a>
        `;
        panelListContainer.appendChild(panelCard);
    });
}

const translations = {
    app_title: { en: "SOLAR FOR ALL", hi: "SOLAR FOR ALL" },
    login_username_placeholder: { en: "Enter Username", hi: "यूजरनेम दर्ज करें" },
    login_password_placeholder: { en: "Enter Password", hi: "पासवर्ड दर्ज करें" },
    login_btn: { en: "Login", hi: "लॉग इन करें" },
    login_welcome: { en: "Welcome! Please log in to continue.", hi: "स्वागत है! जारी रखने के लिए कृपया लॉग इन करें।" },
    invalid_login: { en: "Invalid username or password.", hi: "अवैध उपयोगकर्ता नाम या पासवर्ड।" },
    
    nav_home: { en: "Home", hi: "होम" },
    nav_dashboard: { en: "Mission Control", hi: "मिशन कंट्रोल" },
    nav_calculator: { en: "Calculator", hi: "कैलकुलेटर" },
    nav_chatbot: { en: "AI Chatbot", hi: "AI चैटबॉट" },
    nav_ai_explainer: { en: "Solar Analysis", hi: " सोलर विश्लेषण" },
    nav_ai_visual: { en: "Your Solar Vision", hi: "आपका सोलर विजन" },
    nav_ai_video: { en: "Installation Preview", hi: "इंस्टॉलेशन पूर्वावलोकन" },
    nav_help: { en: "Help", hi: "सहायता" },
    nav_contact: { en: "Contact", hi: "संपर्क" },
    nav_solar_panels: { en: "Solar Panels", hi: "सोलर पैनल" },
    nav_maintenance: { en: "Maintenance", hi: "रखरखाव" },
    
    home_title: { en: "Light up Your Future with Solar Energy!", hi: "सौर ऊर्जा से अपने भविष्य को रोशन करें!" },
    home_subtitle: { en: "Reduce your electricity bills, protect the environment, and move towards a self-reliant energy future. Our 'SOLAR FOR ALL' calculator and AI will guide you every step of the way.", hi: "अपने बिजली के बिल कम करें, पर्यावरण की रक्षा करें और आत्मनिर्भर ऊर्जा भविष्य की ओर बढ़ें। हमारा 'सोलर फॉर ऑल' कैलकुलेटर और AI हर कदम पर आपका मार्गदर्शन करेंगे।" },
    home_card1_title: { en: "Instant Calculation", hi: "तुरंत गणना" },
    home_card1_desc: { en: "Estimate your system size, cost, and savings in seconds.", hi: "सेकंडों में अपने सिस्टम का आकार, लागत और बचत का अनुमान लगाएं।" },
    home_card1_btn: { en: "Go to Calculator", hi: "कैलकुलेटर पर जाएं" },
    home_card2_title: { en: "AI Assistant", hi: "AI सहायक" },
    home_card2_desc: { en: "Ask our AI chatbot anything about solar technology, subsidies, and maintenance.", hi: "हमारे AI चैटबॉट से सौर प्रौद्योगिकी, सब्सिडी और रखरखाव के बारे में कुछ भी पूछें।" },
    home_card2_btn: { en: "Chat Now", hi: "अभी चैट करें" },
    home_card3_title: { en: "Your Solar Vision", hi: "आपका सोलर विजन" },
    home_card3_desc: { en: "Visualize your environmental impact with AI-generated reports and visuals.", hi: "AI-जनरेटेड रिपोर्ट और विज़ुअल के साथ अपने पर्यावरणीय प्रभाव की कल्पना करें।" },
    home_card3_btn: { en: "See Visual", hi: "विज़ुअल देखें" },
    home_card4_title: { en: "Community Impact", hi: "सामुदायिक प्रभाव" },
    home_card4_desc: { en: "See the real-time environmental impact of our solar guardians worldwide.", hi: "दुनिया भर में हमारे सौर संरक्षकों के वास्तविक समय के पर्यावरणीय प्रभाव को देखें।" },
    home_card4_btn: { en: "See Impact", hi: "प्रभाव देखें" },
    gallery_title: { en: "Explore the World of Solar Energy", hi: "सौर ऊर्जा की दुनिया का अन्वेषण करें" },
    gallery1_title: { en: "Rural Village with Solar Panels on Rooftops", hi: "छतों पर सौर पैनलों वाला ग्रामीण गाँव" },
    gallery1_desc: { en: "This image shows a village where individual homes are equipped with rooftop solar panels.", hi: "यह छवि एक गाँव को दिखाती है जहाँ अलग-अलग घरों में छत पर सौर पैनल लगे हुए हैं।" },
    gallery2_title: { en: "Village School with Solar Panels", hi: "सौर पैनलों वाला गाँव का स्कूल" },
    gallery2_desc: { en: "This image highlights a village school powered by solar energy, enabling lighting and computers for students.", hi: "यह छवि सौर ऊर्जा से चलने वाले एक गाँव के स्कूल को दर्शाती है, जो छात्रों के लिए रोशनी और कंप्यूटर को संभव बनाता है।" },
    gallery3_title: { en: "Agricultural Village with Solar-Powered Water Pump", hi: "सौर-संचालित जल पंप वाला कृषि गाँव" },
    gallery3_desc: { en: "This image shows a solar-powered pump irrigating fields, reducing reliance on fossil fuels.", hi: "यह छवि खेतों की सिंचाई करते हुए एक सौर-संचालित पंप को दिखाती है, जिससे जीवाश्म ईंधन पर निर्भरता कम होती है।" },
    gallery4_title: { en: "Night View of a Village Lit by Solar Streetlights", hi: "सौर स्ट्रीटलाइट्स से रोशन एक गाँव का रात का दृश्य" },
    gallery4_desc: { en: "Solar streetlights enhance safety and extend evening activities in villages after dark.", hi: "सौर स्ट्रीटलाइट्स सुरक्षा बढ़ाती हैं और अँधेरा होने के बाद गाँवों में शाम की गतिविधियों का विस्तार करती हैं।" },
    
    dashboard_title: { en: "Mission Control: Community Impact", hi: "मिशन कंट्रोल: सामुदायिक प्रभाव" },
    dashboard_stat1_title: { en: "Collective CO₂ Saved", hi: "सामूहिक CO₂ की बचत" },
    dashboard_stat2_title: { en: "Guardians Joined", hi: "जुड़े हुए संरक्षक" },
    dashboard_stat3_title: { en: "Equivalent Trees Planted", hi: "लगाए गए पेड़ों के बराबर" },
    map_placeholder: { en: "Initializing Global Connection...", hi: "वैश्विक कनेक्शन शुरू हो रहा है..." },
    did_you_know_title: { en: "NASA Tech on Your Roof!", hi: "आपकी छत पर NASA तकनीक!" },
    did_you_know_desc: { en: "The highly efficient solar cell technology we use today was pioneered by NASA to power satellites and spacecraft. By installing solar, you're using space-age tech to protect Earth!", hi: "आज हम जिस अत्यधिक कुशल सौर सेल तकनीक का उपयोग करते हैं, उसकी शुरुआत NASA ने उपग्रहों और अंतरिक्ष यान को बिजली देने के लिए की थी। सौर ऊर्जा लगाकर, आप पृथ्वी की रक्षा के लिए अंतरिक्ष-युग की तकनीक का उपयोग कर रहे हैं!" },
    
    calc_title: { en: "Your Solar Calculator", hi: "आपका सोलर कैलकुलेटर" },
    calc_subtitle: { en: "Enter your bill/units to get system size, cost, and savings.", hi: "सिस्टम का आकार, लागत और बचत जानने के लिए अपना बिल/यूनिट्स दर्ज करें।" },
    surveyor_title: { en: "Virtual Roof Surveyor", hi: "वर्चुअल छत सर्वेक्षक" },
    surveyor_address_label: { en: "Enter your exact address or just your city name.", hi: "अपना सही पता या सिर्फ शहर का नाम दर्ज करें।" },
    address_input_placeholder: { en: "Detecting your location automatically...", hi: "आपकी लोकेशन का स्वतः पता लगाया जा रहा है..." },
    map_load_placeholder: { en: "Map will load here...", hi: "यहां मैप लोड होगा..." },
    surveyor_instructions: { en: "Use the draw tool (■) on the map for exact area.", hi: "सटीक क्षेत्र के लिए मैप पर ड्रॉ टूल (■) का उपयोग करें।" },
    calc_heading: { en: "SOLAR FOR ALL", hi: "सभी के लिए सौर" },
    calc_bill_label: { en: "Monthly Bill (₹)", hi: "मासिक बिल (₹)" },
    calc_units_label: { en: "Monthly Units", hi: "मासिक यूनिट्स" },
    calc_units_label_annual: { en: "Annual Units", hi: "वार्षिक यूनिट्स" },
    calc_tariff_label: { en: "Tariff (₹/unit)", hi: "टैरिफ (₹/यूनिट)" },
    calc_cost_label: { en: "Cost per kW (₹)", hi: "लागत प्रति किलोवाट (₹)" },
    calc_roof_label: { en: "Roof Area (sq ft)", hi: "छत का क्षेत्रफल (वर्ग फुट)" },
    roof_placeholder: { en: "Auto-filled from map", hi: "मैप से स्वतः भरेगा" },
    calc_lang_label: { en: "Language", hi: "भाषा" },
    schemes_title: { en: "Government Schemes & Subsidy", hi: "सरकारी योजनाएं और सब्सिडी" },
    schemes_subtitle: { en: "Get an estimate of your government subsidy.", hi: "अपनी सरकारी सब्सिडी का अनुमान लगाएं।" },
    schemes_state: { en: "State", hi: "राज्य" },
    schemes_income: { en: "Monthly Income (₹)", hi: "मासिक आय (₹)" },
    income_placeholder: { en: "e.g., 20000", hi: "उदाहरण, 20000" },
    schemes_bank: { en: "Loan Bank", hi: "ऋण बैंक" },
    no_loan_option: { en: "No Loan", hi: "कोई ऋण नहीं" },
    schemes_panel: { en: "Panel Type", hi: "पैनल का प्रकार" },
    calc_calc_btn: { en: "Calculate", hi: "गणना करें" },
    calc_reset_btn: { en: "Reset", hi: "रीसेट" },
    aqi_title: { en: "Live Air Quality", hi: "लाइव वायु गुणवत्ता" },
    calc_emi_title: { en: "EMI Comparison", hi: "EMI की तुलना" },
    
    pollution_title: { en: "Pollution Reduction Impact (Source: NASA TEMPO)", hi: "प्रदूषण कम करने का प्रभाव (स्रोत: नासा TEMPO)" },
    explainer_generate_btn: { en: "Generate Solar Analysis", hi: "सोलर विश्लेषण उत्पन्न करें" },
    explainer_generate_btn_text: { en: "Generate Solar Analysis", hi: "सोलर विश्लेषण उत्पन्न करें" },

    chat_title: { en: "Ask Your Solar Bot 🤖", hi: "अपने सोलर बॉट से पूछें 🤖" },
    chat_welcome: { en: "Hello! I'm here to answer your questions about solar energy.", hi: "नमस्ते! मैं सौर ऊर्जा के बारे में आपके सवालों का जवाब देने के लिए यहाँ हूँ।" },
    chat_placeholder: { en: "e.g., How much does solar energy cost?", hi: "जैसे, सौर ऊर्जा की लागत कितनी है?" },
    chat_send_btn: { en: "Send", hi: "भेजें" },
    
    explainer_title: { en: "Solar Analysis", hi: "सोलर विश्लेषण" },
    explainer_subtitle: { en: "Here is your personalized analysis and voice-over script.", hi: "यह आपका व्यक्तिगत विश्लेषण और वॉइस-ओवर स्क्रिप्ट है।" },
    explainer_placeholder: { en: "Your generated script will appear here after calculation.", hi: "गणना के बाद आपका जेनरेट किया गया स्क्रिप्ट यहाँ दिखाई देगा।" },
    explainer_play_btn: { en: "Play", hi: "चलाएँ" },
    explainer_stop_btn: { en: "Stop", hi: "रोकें" },
    visual_title: { en: "Your Solar Vision", hi: "आपका सोलर विजन" },
    visual_subtitle: { en: "Here you can view a personalized visual based on your solar energy calculation. Just click 'Generate Visual'!", hi: "यहाँ आप अपनी सौर ऊर्जा गणना के आधार पर एक व्यक्तिगत विज़ुअल देख सकते हैं। बस 'विज़ुअल उत्पन्न करें' पर क्लिक करें!" },
    visual_placeholder: { en: "Visual will appear here", hi: "विज़ुअल यहाँ दिखाई देगा" },
    visual_generate_btn: { en: "Generate Visual", hi: "विज़ुअल उत्पन्न करें" },
    video_title: { en: "Installation Preview", hi: "इंस्टॉलेशन पूर्वावलोकन" },
    video_subtitle: { en: "Here you can watch a personalized video based on your solar energy calculation. Just click 'Generate Video'!", hi: "यहाँ आप अपनी सौर ऊर्जा गणना के आधार पर एक व्यक्तिगत वीडियो देख सकते हैं। बस 'वीडियो उत्पन्न करें' पर क्लिक करें!" },
    video_placeholder: { en: "Video will appear here", hi: "वीडियो यहाँ दिखाई देगा" },
    video_generate_btn: { en: "Generate Video", hi: "वीडियो उत्पन्न करें" },
    
    help_title: { en: "Help Center", hi: "सहायता केंद्र" },
    help_subtitle1: { en: "Here you will find answers to frequently asked questions about solar energy, our calculator, and services.", hi: "यहाँ आपको सौर ऊर्जा, हमारे कैलकुलेटर और सेवाओं के बारे में अक्सर पूछे जाने वाले सवालों के जवाब मिलेंगे।" },
    faq1_q: { en: "What is solar energy?", hi: "सौर ऊर्जा क्या है?" },
    faq1_a: { en: "Solar energy is energy generated by converting sunlight into electricity, typically using photovoltaic (PV) panels.", hi: "सौर ऊर्जा वह ऊर्जा है जो सूर्य के प्रकाश को बिजली में बदलकर उत्पन्न होती है, आमतौर पर फोटोवोल्टिक (PV) पैनलों का उपयोग करके।" },
    faq2_q: { en: "What are the benefits of solar energy?", hi: "सौर ऊर्जा के क्या फायदे हैं?" },
    faq2_a: { en: "Solar energy reduces electricity bills, decreases the carbon footprint, and provides energy independence.", hi: "सौर ऊर्जा बिजली के बिल को कम करती है, कार्बन फुटप्रिंट को घटाती है और ऊर्जा स्वतंत्रता प्रदान करती है।" },
    faq3_q: { en: "How often should I clean the solar panels?", hi: "मुझे सोलर पैनल कितनी बार साफ करने चाहिए?" },
    faq3_a: { en: "Panels should be cleaned every 15-30 days, especially during dry, dusty seasons, to prevent a 15-20% drop in efficiency.", hi: "पैनलों को हर 15-30 दिन में साफ करना चाहिए, खासकर सूखे और धूल भरे मौसम में, ताकि दक्षता में 15-20% की गिरावट से बचा जा सके।" },
    faq4_q: { en: "What is the Payback Period for a typical system?", hi: "एक सामान्य सिस्टम का रिकवरी पीरियड (Payback Period) क्या है?" },
    faq4_a: { en: "The typical payback period ranges from 4 to 6 years, depending on the system size, upfront cost, and local electricity tariffs.", hi: "रिकवरी पीरियड आमतौर पर 4 से 6 साल तक होता है, जो सिस्टम के आकार, प्रारंभिक लागत और स्थानीय बिजली टैरिफ पर निर्भर करता है।" },
    faq5_q: { en: "Do solar systems require a separate Battery?", hi: "क्या सोलर सिस्टम के लिए अलग से बैटरी की आवश्यकता होती है?" },
    faq5_a: { en: "Grid-tied systems (On-Grid) usually do not need a battery. Only Off-Grid or Hybrid systems use batteries for nighttime backup power.", hi: "ग्रिड से जुड़े सिस्टम (On-Grid) में आमतौर पर बैटरी की आवश्यकता नहीं होती है। केवल Off-Grid या हाइब्रिड सिस्टम रात में बैकअप पावर के लिए बैटरी का उपयोग करते हैं।" },

    contact_title: { en: "Contact Us", hi: "संपर्क" },
    contact_subtitle: { en: "Contact us to learn more about our solar energy solutions or for any inquiries.", hi: "हमारे सौर ऊर्जा समाधानों के बारे में अधिक जानने या किसी भी पूछताछ के लिए हमसे संपर्क करें।" },
    contact_name_placeholder: { en: "Your Name", hi: "आपका नाम" },
    contact_email_placeholder: { en: "Your Email", hi: "आपका ईमेल" },
    contact_message_placeholder: { en: "Your Message", hi: "आपका संदेश" },
    contact_send_btn: { en: "Send Message", hi: "संदेश भेजें" },
    footer_text: { en: "&copy; 2025 SOLAR FOR ALL.", hi: "&copy; 2025 SOLAR FOR ALL" },
    
    size_label: { en: "System Size", hi: "सिस्टम का आकार" },
    cost_label: { en: "Total Cost", hi: "कुल लागत" },
    savings_label: { en: "Monthly Savings", hi: "मासिक बचत" },
    payback_label: { en: "Payback", hi: "रिकवरी" },
    co2_label: { en: "CO₂ Saved", hi: "बचाई गई CO₂" },
    trees_label: { en: "Trees Equivalent", hi: "पेड़ों के बराबर" },
    monthly_payment_label: { en: "Monthly Payment (₹)", hi: "मासिक भुगतान (₹)" },
    emi_label_12: { en: "12 EMI", hi: "12 EMI" },
    emi_label_24: { en: "24 EMI", hi: "24 EMI" },
    emi_label_36: { en: "36 EMI", hi: "36 EMI" },
    pollution_remaining: { en: "Remaining AQI", hi: "शेष AQI" },
    pollution_reduced: { en: "AQI Reduced by Solar", hi: "सौर ऊर्जा से कम हुआ AQI" },
    aqi_label: { en: "Air Quality Index (AQI)", hi: "वायु गुणवत्ता सूचकांक (AQI)" },
    original_aqi: { en: "Original AQI", hi: "मूल AQI" },
    aqi_good: { en: "Good", hi: "अच्छा" },
    aqi_moderate: { en: "Moderate", hi: "मध्यम" },
    aqi_unhealthy: { en: "Unhealthy", hi: "अस्वास्थ्यकर" },
    aqi_city: { en: "City/Address", hi: "शहर/पता" }, // Updated label
    gamification_title: { en: "🚀 Your Mission Impact", hi: "🚀 आपके मिशन का प्रभाव" },
    gamification_rover: { en: "Your annual energy could power NASA's <strong>Perseverance Rover on Mars for {roverDays} days!</strong>", hi: "आपकी वार्षिक ऊर्जा नासा के <strong>पर्सिवरेंस रोवर को मंगल ग्रह पर {roverDays} दिनों तक चला सकती है!</strong>" },
    gamification_iss: { en: "It could also power the <strong>International Space Station for {issSeconds} seconds!</strong>", hi: "यह <strong>अंतर्राष्ट्रीय अंतरिक्ष स्टेशन को {issSeconds} सेकंड तक भी चला सकती है!</strong>" },
    gamification_button: { en: "Activate Solar Colonist Mode", hi: "सौर उपनिवेशक मोड सक्रिय करें" },
    colonist_title: { en: "🚀 Solar Colonist Mode", hi: "🚀 सौर उपनिवेशक मोड" },
    colonist_subtitle: { en: "Here's the solar setup your home would need to survive off-world.", hi: "यह सौर सेटअप है जिसकी आपके घर को बाहरी दुनिया में जीवित रहने के लिए ज़रूरत होगी।" },
    mars_description: { en: "Due to a thin atmosphere and dust storms, you'd need a robust system.", hi: "पतले वायुमंडल और धूल भरी आँधियों के कारण, आपको एक मजबूत सिस्टम की ज़रूरत होगी।" },
    moon_description: { en: "To survive the 14-day lunar night, massive energy storage is critical.", hi: "14-दिवसीय चंद्र रात में जीवित रहने के लिए, बड़े पैमाने पर ऊर्जा भंडारण महत्वपूर्ण है।" },
    system_size_label: { en: "System Size", hi: "सिस्टम का आकार" },
    battery_storage_label: { en: "Battery Storage", hi: "बैटरी स्टोरेज" },
    colonist_error: { en: "Please calculate your Earth-based system first!", hi: "कृपया पहले अपने पृथ्वी-आधारित सिस्टम की गणना करें!" },
    
    subsidy_not_eligible_title: { en: "❌ Not Eligible for Subsidy", hi: "❌ सब्सिडी के लिए पात्र नहीं" },
    subsidy_not_eligible_desc: { en: "Your electricity bill is very low, which suggests solar energy might not be the most economical option for you right now.", hi: "आपका बिजली बिल बहुत कम है, जो दर्शाता है कि सौर ऊर्जा अभी आपके लिए सबसे किफायती विकल्प नहीं हो सकती है।" },
    subsidy_eligible_title: { en: "💰 Your Subsidy Potential", hi: "💰 आपकी सब्सिडी की संभावना" },
    subsidy_eligible_desc: { en: "Based on your details, you may be eligible for the <strong>{schemeName}</strong>.", hi: "आपके विवरण के आधार पर, आप <strong>{schemeName}</strong> के लिए पात्र हो सकते हैं।" },
    subsidy_amount: { en: "Estimated Subsidy Amount: <strong>₹{subsidyAmount}</strong>", hi: "अनुमानित सब्सिडी राशि: <strong>₹{subsidyAmount}</strong>" },
    subsidy_cost_after: { en: "Cost after subsidy: <strong>₹{finalCost}</strong>", hi: "सब्सिडी के बाद लागत: <strong>₹{finalCost}</strong>" },
    subsidy_loan_details: { en: "Your estimated <strong>{bankName}</strong> EMI is <strong>₹{monthlyEMI}/month</strong> for a period of {loanTenure} years.", hi: "आपकी अनुमानित <strong>{bankName}</strong> EMI {loanTenure} साल की अवधि के लिए <strong>₹{monthlyEMI}/महीना</strong> है।" },
    subsidy_disclaimer: { en: "This is an estimate. Final amount may vary. Apply on the official government portal.", hi: "यह एक अनुमान है। अंतिम राशि भिन्न हो सकती है। आधिकारिक सरकारी पोर्टल पर आवेदन करें।" },
    no_scheme_found: { en: "No specific scheme found", hi: "कोई विशेष योजना नहीं मिली" },
    no_loan: { en: "No Loan", hi: "कोई ऋण नहीं" },

    calculating_solar: { en: "Calculating your solar potential...", hi: "आपकी सौर क्षमता की गणना की जा रही है..." },
    invalid_input: { en: "Please enter valid positive numbers.", hi: "कृपया वैध सकारात्मक संख्याएं दर्ज करें।" },
    system_size_adjusted_roof: { en: "System size adjusted to fit your roof area.", hi: "सिस्टम का आकार आपकी छत के क्षेत्रफल के अनुसार समायोजित किया गया है।" },
    system_size_adjusted_budget: { en: "System size adjusted to fit your budget.", hi: "सिस्टम का आकार आपके बजट के अनुसार समायोजित किया गया है।" },
    reset_message: { en: "Form has been reset.", hi: "फॉर्म रीसेट हो गया है।" },
    message_sent_success: { en: "Message sent successfully!", hi: "संदेश सफलतापूर्वक भेजा गया!" },
    buy_link_text: { en: "Official Buy Link", hi: "आधिकारिक खरीदने का लिंक" },
    explainer_generated_message: { en: "AI Solar Analysis Generated!", hi: "AI सौर विश्लेषण उत्पन्न हुआ!" },
    explainer_generate_first_message: { en: "Please run a calculation first to generate an AI explainer.", hi: "कृपया पहले एक गणना चलाएँ ताकि AI एक्सप्लेनर उत्पन्न हो सके।" },
    visual_error: { en: "Please run a calculation first.", hi: "कृपया पहले एक गणना चलाएँ।" },
    visual_generated: { en: "AI visual generated!", hi: "AI विज़ुअल उत्पन्न हुआ!" },
    video_error: { en: "Please run a calculation first.", hi: "कृपया पहले एक गणना चलाएँ." },
    video_generated: { en: "AI video generated!", hi: "AI वीडियो उत्पन्न हुआ!" },
    location_not_found: { en: "Location not found. Please enter a valid address.", hi: "स्थान नहीं मिला। कृपया एक वैध पता दर्ज करें।" },
    location_detecting: { en: "Attempting to auto-detect your location...", hi: "आपकी लोकेशन का स्वतः पता लगाने का प्रयास किया जा रहा है..." },
    location_gps_success: { en: "GPS location detected!", hi: "जीपीएस लोकेशन का पता चला!" },
    location_gps_fail: { en: "GPS location detected, but could not find address.", hi: "जीपीएस लोकेशन का पता चला, लेकिन पता नहीं मिल सका।" },
    location_detected_label: { en: "Detected Location", hi: "पता लगाया गया स्थान" },
    location_ip_try: { en: "GPS failed. Trying to find city via IP address...", hi: "जीपीएस विफल। आईपी एड्रेस के माध्यम से शहर खोजने का प्रयास किया जा रहा है..." },
    location_ip_success: { en: "Approximate location found: {city}", hi: "अनुमानित लोकेशन मिली: {city}" },
    location_approximate_label: { en: "Approximate location: {city}", hi: "अनुमानित स्थान: {city}" },
    location_autodetect_fail: { en: "Automatic location detection failed.", hi: "स्वचालित लोकेशन का पता लगाना विफल रहा।" },
    location_not_supported: { en: "Geolocation is not supported by your browser.", hi: "आपके ब्राउज़र द्वारा जियोलोकेशन समर्थित नहीं है।" },
    location_prompt: { en: "Please enter an address or enable location services.", hi: "कृपया एक पता दर्ज करें या लोकेशन सेवाएँ सक्षम करें।" },
    location_address_not_found: { en: "Could not find location from entered address.", hi: "दर्ज किए गए पते से लोकेशन नहीं मिल सका।" },
    nasa_fetching: { en: "Fetching Solar Data (POWER) from NASA...", hi: "नासा से सौर डेटा (POWER) प्राप्त किया जा रहा है..." },
    nasa_unavailable: { en: "⚠️ NASA data unavailable. Using estimate (4.5 kWh).", hi: "⚠️ नासा डेटा उपलब्ध नहीं है। अनुमान का उपयोग किया जा रहा है (4.5 kWh)。" },
    
    nasa_fetching_aqi: { en: "Fetching Air Quality (TEMPO/OMPS) from NASA...", hi: "नासा से वायु गुणवत्ता (TEMPO/OMPS) डेटा प्राप्त किया जा रहा है..." },
    uhi_tip_title: { en: "Urban Heat Island Insight", hi: "शहरी ऊष्मा द्वीप (UHI) जानकारी" },
    uhi_tip_high: { en: "NASA LST data suggests high local temperature. Consider installing Solar Panels with a white or reflective backing and prioritize green roofing/cooling solutions to combat UHI.", hi: "नासा LST डेटा उच्च स्थानीय तापमान का सुझाव देता है। UHI का मुकाबला करने के लिए सफेद या परावर्तक बैक वाली सोलर पैनल स्थापित करने पर विचार करें और हरित छत/शीतलन समाधानों को प्राथमिकता दें।" },
    uhi_tip_low: { en: "NASA LST data suggests moderate local temperature. Your solar installation will still help prevent local heat buildup.", hi: "नासा LST डेटा मध्यम स्थानीय तापमान का सुझाव देता है। आपकी सौर स्थापना अभी भी स्थानीय गर्मी के निर्माण को रोकने में मदद करेगी।" },
    
    maintenance_title: { en: "🛠️ Solar System Maintenance & Health Check", hi: "🛠️ सोलर सिस्टम का रखरखाव और स्वास्थ्य जाँच" },
    capacity_selector_label: { en: "Select Your System Capacity:", hi: "अपनी सिस्टम क्षमता चुनें:" },
    capacity_small_option: { en: "Small System (< 5kW)", hi: "छोटा सिस्टम (< 5kW)" },
    capacity_medium_option: { en: "Medium System (5kW - 20kW)", hi: "मध्यम सिस्टम (5kW - 20kW)" },
    capacity_large_option: { en: "Large/Commercial (> 20kW)", hi: "बड़ा/व्यावसायिक (> 20kW)" },
    capacity_tips_title: { en: "Capacity-Based Maintenance Tips", hi: "क्षमता-आधारित रखरखाव के सुझाव" },
    monthly_checklist_title: { en: "🗓️ Monthly Maintenance Checklist", hi: "🗓️ मासिक रखरखाव चेकलिस्ट" },
    monthly_checklist_subtitle: { en: "Complete these tasks every month to ensure maximum system efficiency.", hi: "सिस्टम की अधिकतम दक्षता सुनिश्चित करने के लिए हर महीने इन कार्यों को पूरा करें।" },
    save_log_btn: { en: "✅ Save Log", hi: "✅ लॉग सहेजें" },
    annual_check_title: { en: "⭐ Annual Professional Inspection", hi: "⭐ वार्षिक पेशेवर निरीक्षण" },
    annual_check_subtitle: { en: "Schedule a professional technician once a year for an overall health check-up.", hi: "समग्र स्वास्थ्य जाँच के लिए साल में एक बार एक पेशेवर तकनीशियन को बुलाएँ।" },

    chatbot_no_answer: { en: "I'm sorry, I can only answer questions from my knowledge base. Please ask about solar energy.", hi: "क्षमा करें, मैं केवल अपने ज्ञानकोष के प्रश्नों का उत्तर दे सकता हूँ। कृपया सौर ऊर्जा के बारे में पूछें।" },
    chatbot_fallback_answers: {
        greetings: {
            keywords: ["hi", "hello", "hey", "namaste", "namaskar", "hy", "hie", "hii", "helo", "helllo", "hlo", "heyy", "hay"],
            answer_en: "Hello! I am a solar energy assistant. How can I help you with solar today?",
            answer_hi: "नमस्ते! मैं एक सौर ऊर्जा सहायक हूँ। आज मैं सौर ऊर्जा से संबंधित आपकी क्या मदद कर सकता हूँ?"
        },
        how_are_you: {
            keywords: ["how are you", "kaise ho", "kya haal hai"],
            answer_en: "I'm doing great! How can I help you with solar power today?",
            answer_hi: "मैं बहुत अच्छा हूँ! मैं आज सौर ऊर्जा से संबंधित आपकी क्या मदद कर सकता हूँ?"
        },
        who_are_you: {
            keywords: ["who are you", "tum kon ho", "ap kon ho", "hu r u", "who r yu", "whu are yuo"],
            answer_en: "I am a helpful AI assistant designed to provide information about solar energy, subsidies, and installation.",
            answer_hi: "मैं एक सहायक AI हूँ जिसे सौर ऊर्जा, सब्सिडी और इंस्टॉलेशन के बारे में जानकारी देने के लिए डिज़ाइन किया गया है।"
        },
        what_can_you_do: {
            keywords: ["what can you do", "kya kar sakte ho", "tum kya kar sakte ho", "wat can u du", "wht cn you doo", "whatt can yo do"],
            answer_en: "I can help you calculate your solar potential, find subsidies, and answer common questions about solar energy.",
            answer_hi: "मैं आपकी सौर क्षमता की गणना करने, सब्सिडी खोजने और सौर ऊर्जा के बारे में सामान्य प्रश्नों का उत्तर देने में आपकी मदद कर सकता हूँ।"
        },
        are_you_a_solar_chatbot: {
            keywords: ["are you a solar chatbot", "kya tum solar chatbot ho"],
            answer_en: "Yes, I am a specialized chatbot for solar energy.",
            answer_hi: "हाँ, मैं सौर ऊर्जा के लिए एक विशेष चैटबॉट हूँ।"
        },
        what_is_solar_energy: {
            keywords: ["what is solar energy", "solar urja kya hai", "kya hai solar energy", "solar energy kya hai", "wat is solr enegy", "wht is solor enrgy", "whatt is soar enery", "solar", "energy"],
            answer_en: "Solar energy is energy from the sun that is converted into thermal or electrical energy. It is a clean and renewable resource.",
            answer_hi: "सौर ऊर्जा सूर्य से प्राप्त होने वाली ऊर्जा है जिसे तापीय या विद्युत ऊर्जा में परिवर्तित किया जाता है। यह एक स्वच्छ और नवीकरणीय संसाधन है।"
        },
        how_does_solar_energy_work: {
            keywords: ["how does solar energy work", "solar energy kaise kaam karta hai", "kaise kaam karti hai solar energy", "how du solr enegy wrk", "hw dos solor enrgy work", "howduss soar enrg wrks"],
            answer_en: "Solar panels absorb sunlight and convert it into direct current (DC) electricity through the photovoltaic effect. An inverter then converts this DC into alternating current (AC) for home use.",
            answer_hi: "सोलर पैनल सूर्य के प्रकाश को अवशोषित करते हैं और इसे फोटोवोल्टिक प्रभाव के माध्यम से सीधे करंट (DC) बिजली में परिवर्तित करते हैं। फिर एक इन्वर्टर इस DC को घरों में उपयोग के लिए अल्टरनेटिंग करंट (AC) में बदल देता है।"
        },
        benefits_of_solar_energy: {
            keywords: ["benefits of solar energy", "solar ke fayde", "solar energy ke kya fayde hain", "benfits of solr enegy", "benifits of solor enrgy", "benefitz of soar enery", "solar advantage kya hai", "soler advntages batao", "solar adwantage explain", "advantage of sola energy", "advntg of solr power", "benefits", "fayde"],
            answer_en: "The main benefits are reduced electricity bills, a lower carbon footprint, energy independence, and increased property value.",
            answer_hi: "मुख्य लाभों में कम बिजली बिल, कम कार्बन फुटप्रिंट, ऊर्जा आत्मनिर्भरता और संपत्ति के मूल्य में वृद्धि शामिल है।"
        },
        disadvantages_of_solar_energy: {
            keywords: ["disadvantages of solar energy", "solar ke nuksaan", "solar energy ke kya nuksaan hain", "disadvantges of solr enegy", "disadvanages of solor enrgy", "disadvntgs of soar enery", "solar disadvantage kya hai", "disadwntg of solr enrg", "solar drawbck list", "disadvantages", "nuksaan"],
            answer_en: "The disadvantages include high initial cost, dependence on weather conditions, and the need for a large space for installation.",
            answer_hi: "नुकसान में उच्च प्रारंभिक लागत, मौसम की स्थिति पर निर्भरता और स्थापना के लिए बड़ी जगह की आवश्यकता शामिल है।"
        },
        difference_solar_power_energy: {
            keywords: ["difference between solar power and solar energy", "difrnce betwen solr pwer and solor enegy", "diference btwin soar power n enrgy", "diff betwen sollar powr n enery"],
            answer_en: "Solar energy refers to the radiant light and heat from the sun. Solar power refers to the conversion of this energy into electricity.",
            answer_hi: "सौर ऊर्जा सूर्य से निकलने वाली प्रकाश और गर्मी को संदर्भित करती है। सौर ऊर्जा इस ऊर्जा को बिजली में बदलने को संदर्भित करती है।"
        },
        what_is_a_solar_cell: {
            keywords: ["what is a solar cell", "solar cell kya hai", "solr cel", "solor sel", "soar sell", "solar cell working", "solr cel working", "solar cel working", "solar cell", "cell"],
            answer_en: "A solar cell is the smallest unit of a solar panel that converts sunlight directly into electricity. Solar panels are made of many solar cells.",
            answer_hi: "सौर सेल एक सोलर पैनल की सबसे छोटी इकाई है जो सूर्य के प्रकाश को सीधे बिजली में परिवर्तित करती है। सोलर पैनल कई सौर सेलों से बने होते हैं।"
        },
        what_is_photovoltaic_energy: {
            keywords: ["what is photovoltaic energy", "photovoltaic urja", "wat is fotovoltaic enrgy", "wht is photovoltic enegy", "whatt is photo voltaik enery", "pv cell kya h", "pv vs thermal solr", "full form of pv in solar", "photovoltaic"],
            answer_en: "Photovoltaic (PV) energy is the process of converting sunlight directly into electricity using solar panels. The 'PV' in PV cell stands for Photovoltaic.",
            answer_hi: "फोटोवोल्टिक (PV) ऊर्जा सोलर पैनलों का उपयोग करके सूर्य के प्रकाश को सीधे बिजली में परिवर्तित करने की प्रक्रिया है। PV सेल में 'PV' का अर्थ फोटोवोल्टिक है।"
        },
        who_invented_solar_panels: {
            keywords: ["who invented solar panels", "solar panel kisne banaya", "hu inventd solr panals", "who invnted solor penels", "whu invent sollar panal", "who invented solar cell", "invented", "inventor"],
            answer_en: "The photovoltaic effect was discovered by Edmond Becquerel in 1839. The first practical solar cell was developed by Bell Labs in 1954.",
            answer_hi: "फोटोवोल्टिक प्रभाव की खोज 1839 में एडमंड बेकरेल ने की थी। पहला व्यावहारिक सौर सेल 1954 में बेल लैब्स द्वारा विकसित किया गया था।"
        },
        can_solar_energy_run_a_house: {
            keywords: ["can solar energy run a house", "solar se ghar chalta hai", "cn solr enegy rn house", "can solor enrg run hous", "cann soar enrgy rn haus", "home solr system price", "run house", "ghar chala"],
            answer_en: "Yes, a well-sized solar system can power an entire house. The system size depends on your electricity usage.",
            answer_hi: "हाँ, एक अच्छी तरह से आकार का सौर ऊर्जा सिस्टम पूरे घर को बिजली दे सकता है। सिस्टम का आकार आपकी बिजली की खपत पर निर्भर करता है।"
        },
        can_solar_energy_work_at_night: {
            keywords: ["can solar energy work at night", "raat me solar kaam karta hai", "cn solr enegy wrk at nite", "can solor enrg wrk nigh", "cann soar enrgy wrks at nyt", "nighttime solar working", "does solr work at night", "how solr work at nght", "night", "raat"],
            answer_en: "No, solar panels do not generate electricity at night. However, if you have a battery backup system, you can use the stored power.",
            answer_hi: "नहीं, सोलर पैनल रात में बिजली पैदा नहीं करते हैं। हालाँकि, यदि आपके पास बैटरी बैकअप सिस्टम है, तो आप संग्रहीत बिजली का उपयोग कर सकते हैं।"
        },
        what_are_solar_panels: {
            keywords: ["what are solar panels", "solar panel kya hote hain", "solar panels kya hai", "wat are solr panals", "wht r solor penels", "whatt are soar panal", "panels", "panel", "panals"],
            answer_en: "Solar panels are devices that convert sunlight into electricity. They are made of multiple solar cells connected together.",
            answer_hi: "सोलर पैनल ऐसे उपकरण हैं जो सूर्य के प्रकाश को बिजली में बदलते हैं। वे एक साथ जुड़े हुए कई सोलर सेल से बने होते हैं।"
        },
        types_of_solar_panels: {
            keywords: ["types of solar panels", "solar panel ke prakar", "mono", "poly", "thin-film", "typs of solr panals", "type of solor penels", "typpes of sollar panal", "kind of solar panel", "all types of solar panel", "types"],
            answer_en: "The most common types are Monocrystalline (Mono-PERC), Polycrystalline, and Thin-film. Monocrystalline are generally the most efficient for homes.",
            answer_hi: "सबसे सामान्य प्रकार मोनोक्रिस्टलाइन (Mono-PERC), पॉलीक्रिस्टलाइन और थिन-फिल्म हैं। मोनोक्रिस्टलाइन आमतौर पर घरों के लिए सबसे कुशल होते हैं।"
        },
        best_panel_for_home: {
            keywords: ["which solar panel is best for home", "ghar ke liye sabse accha solar panel", "wich solr panal is bst fr home", "whch solor penel best 4 hom", "wich sollar panals bst house", "which solr panel best", "best panel", "best for home"],
            answer_en: "Monocrystalline panels are often considered the best for homes due to their high efficiency and compact size.",
            answer_hi: "मोनोक्रिस्टलाइन पैनलों को उनकी उच्च दक्षता और कॉम्पैक्ट आकार के कारण अक्सर घरों के लिए सबसे अच्छा माना जाता है।"
        },
        efficiency_of_solar_panels: {
            keywords: ["efficiency of solar panels", "solar panel kitna efficient hai", "effciency of solr panals", "eficiency of solor penels", "effishency of soar panal", "panel efficiency", "efficiency"],
            answer_en: "Modern solar panels typically have an efficiency of 17-22%. Higher efficiency means more power generation from the same amount of sunlight.",
            answer_hi: "आधुनिक सोलर पैनलों की दक्षता आमतौर पर 17-22% होती है। उच्च दक्षता का मतलब है कि सूरज की रोशनी की समान मात्रा से अधिक बिजली उत्पादन।"
        },
        lifespan_of_solar_panels: {
            keywords: ["life span of solar panels", "solar panel kitne saal chalta hai", "lyf span of solr panals", "life spam of solor penels", "lifespan of soar panal", "lifespan of solar panel", "durability of solr panl", "lifespan", "life span"],
            answer_en: "Quality solar panels can last for 25 years or more, and they continue to generate power throughout their lifespan.",
            answer_hi: "अच्छे सोलर पैनल 25 साल या उससे ज़्यादा चल सकते हैं, और वे इस दौरान बिजली पैदा करते रहते हैं।"
        },
        cost_of_solar_panels_india: {
            keywords: ["cost of solar panels in india", "india me solar panel ka kharcha", "cost of solr panals in indya", "cst of solor penel india", "cozt of soar panal in inda", "actual cost of solar setup", "approx solr panel price", "rate of solar panel", "cost", "kharcha", "price", "daam", "rate", "total cost", "total kharcha", "solar panel me kharch kitna aayega"],
            answer_en: "The cost in India is approximately ₹50,000 to ₹70,000 per kilowatt, but this can vary by state and brand. Our calculator can give you a better estimate.",
            answer_hi: "भारत में लागत प्रति किलोवाट लगभग ₹50,000 से ₹70,000 है, लेकिन यह राज्य और ब्रांड के अनुसार भिन्न हो सकती है। हमारा कैलकुलेटर आपको एक बेहतर अनुमान दे सकता है।"
        },
        how_many_panels_for_house: {
            keywords: ["how many solar panels do I need for my house", "ghar ke liye kitne panel chahiye", "hw many solr panals I ned for hous", "how meny solor penel do i nid home", "howmny soar panals fr haus"],
            answer_en: "The number of panels depends on your electricity usage and the available roof area. Our calculator can help you find the right system size for your needs.",
            answer_hi: "पैनलों की संख्या आपकी बिजली की खपत और उपलब्ध छत के क्षेत्रफल पर निर्भर करती है। हमारा कैलकुलेटर आपकी ज़रूरतों के लिए सही सिस्टम का आकार खोजने में आपकी मदद कर सकता है।"
        },
        how_to_install_solar_panels: {
            keywords: ["how to install solar panels", "installation process", "solar panel kaise lagayein", "hw to instal solr panals", "how to instol solor penels", "hou to instll soar panal", "install solar panel cost", "install", "installation"],
            answer_en: "Installation involves mounting the panels on your roof, connecting them to an inverter, and integrating the system with your home's electrical grid. It's best to hire a certified professional for this.",
            answer_hi: "इंस्टॉलेशन में पैनलों को आपकी छत पर लगाना, उन्हें इन्वर्टर से जोड़ना, और सिस्टम को आपके घर की बिजली ग्रिड के साथ एकीकृत करना शामिल है। इसके लिए किसी प्रमाणित पेशेवर को किराए पर लेना सबसे अच्छा है।"
        },
        space_required_for_solar_panels: {
            keywords: ["space required for solar panels", "kitni jagah chahiye solar panel ke liye", "spce requrd fr solr panals", "space requir for solor penel", "spase req fr soar panal", "location reqrmnt solar", "space", "jagah"],
            answer_en: "A 1 kW solar system generally requires about 100 sq ft of shadow-free roof area. The space needed depends on the system size.",
            answer_hi: "1 किलोवाट सौर प्रणाली के लिए आमतौर पर लगभग 100 वर्ग फुट छाया-मुक्त छत क्षेत्र की आवश्यकता होती है। आवश्यक स्थान सिस्टम के आकार पर निर्भर करता है।"
        },
        rooftop_installation_process: {
            keywords: ["rooftop solar installation process", "rooftop solr instalation proces", "rooftp solor instol procss", "roftop soar instll process", "rooftop"],
            answer_en: "The rooftop installation process includes site assessment, system design, structural analysis, mounting panel frames, and electrical wiring.",
            answer_hi: "रूफटॉप इंस्टॉलेशन प्रक्रिया में साइट का आकलन, सिस्टम डिज़ाइन, संरचनात्मक विश्लेषण, पैनल फ्रेम लगाना और इलेक्ट्रिकल वायरिंग शामिल है।"
        },
        on_grid_vs_off_grid: {
            keywords: ["on-grid vs off-grid", "on-grid", "off-grid", "hybrid system", "ongrid vs ofgrid solr systm", "on grid vs of grd solor system", "ongrid vs ofgrid soar systm", "grid connected solr systm", "grid tied solar inverter", "grid off solr systm", "on grid", "off grid"],
            answer_en: "On-grid systems are connected to the public power grid. Off-grid systems are independent and use batteries. Hybrid systems combine both for maximum reliability.",
            answer_hi: "ऑन-ग्रिड सिस्टम सार्वजनिक पावर ग्रिड से जुड़े होते हैं। ऑफ-ग्रिड सिस्टम स्वतंत्र होते हैं और बैटरी का उपयोग करते हैं। हाइब्रिड सिस्टम अधिकतम विश्वसनीयता के लिए दोनों को जोड़ते हैं।"
        },
        cost_of_system_size: {
            keywords: ["cost of installing a 1kw, 3kw, 5kw system", "1kw ka kharcha", "3kw ka kharcha", "5kw ka kharcha", "cst of instalng 1kw solr systm", "cost of instoll 1kw solor sys", "cozt installng 1 kw soar systm", "actual cost of solar setup", "one kw solr unit price", "kwp in solr system", "kw solar cost india", "unit prce solr system", "1kw", "3kw", "5kw"],
            answer_en: "The cost per kilowatt is between ₹50,000 to ₹70,000. So, a 1kW system costs around ₹50-70k, a 3kW system around ₹1.5-2.1 lakh, and a 5kW system around ₹2.5-3.5 lakh.",
            answer_hi: "प्रति किलोवाट लागत ₹50,000 से ₹70,000 के बीच है। इसलिए, 1kW सिस्टम की लागत लगभग ₹50-70k, 3kW सिस्टम की लगभग ₹1.5-2.1 लाख, और 5kW सिस्टम की लगभग ₹2.5-3.5 लाख होती है।"
        },
        government_subsidy: {
            keywords: ["government subsidy for solar installation", "sarkari subsidy", "solar subsidy india", "govrment subsdy fr solr instaltion", "goverment subcidy solor instol", "govmnt subsedy fr soar instll", "any govt scheme for solr", "free solar scheme govt", "subsidy", "sarkari scheme"],
            answer_en: "Yes, the Indian government offers subsidies under the 'PM Surya Ghar Muft Bijli Yojana'. Our calculator can help you estimate your subsidy amount.",
            answer_hi: "हाँ, भारत सरकार 'पीएम सूर्य घर मुफ्त बिजली योजना' के तहत सब्सिडी प्रदान करती है। हमारा कैलकुलेटर आपकी सब्सिडी राशि का अनुमान लगाने में आपकी मदद कर सकता है।"
        },
        how_to_clean_solar_panels: {
            keywords: ["how to clean solar panels", "solar panel kaise saaf karein", "hw to clen solr panals", "how to cln solor penels", "hou to klean soar panal", "how to clean solr panel", "clean solar panel", "clean", "saaf"],
            answer_en: "Solar panels should be cleaned regularly to remove dust and dirt. You can use a soft brush and water, but avoid harsh chemicals.",
            answer_hi: "धूल और गंदगी हटाने के लिए सोलर पैनलों को नियमित रूप से साफ करना चाहिए। आप एक नरम ब्रश और पानी का उपयोग कर सकते हैं, लेकिन कठोर रसायनों से बचें।"
        },
        do_solar_panels_work_on_cloudy_days: {
            keywords: ["do solar panels work on cloudy days", "badal me solar kaam karta hai", "do solr panals wrk on clody days", "du solor penel work on clowdy dayz", "do soar panal wrks in cludy day", "is solr effctv in cloudy", "overcast day solar work", "cloudy", "badal"],
            answer_en: "Yes, solar panels still work on cloudy days, but their output is reduced. They can typically generate 10-25% of their normal output.",
            answer_hi: "हाँ, सोलर पैनल बादलों वाले दिनों में भी काम करते हैं, लेकिन उनका उत्पादन कम हो जाता है। वे आमतौर पर अपने सामान्य उत्पादन का 10-25% उत्पन्न कर सकते हैं।"
        },
        common_problems_in_solar_panels: {
            keywords: ["common problems in solar panels", "solar panel ki samasyayein", "common problms in solr panals", "comon prblms in solor penels", "comn problm soar panal", "problems", "samasyayein"],
            answer_en: "Common problems include dirt buildup, inverter issues, and physical damage. Regular maintenance can prevent most of these.",
            answer_hi: "सामान्य समस्याओं में धूल का जमाव, इन्वर्टर की समस्याएं और भौतिक क्षति शामिल हैं। नियमित रखरखाव इनमें से अधिकांश को रोक सकता है।"
        },
        maintenance_cost: {
            keywords: ["maintenance cost of solar panels", "solar panel ka maintenance kharcha", "maintenence cost of solr panals", "maintanance cst of solor penels", "maintnce cozt soar panal", "maintenance of solar panel", "maintenance"],
            answer_en: "Solar panels have very low maintenance costs, mainly for cleaning and occasional check-ups. A professional check-up might cost between ₹500 to ₹1500 per year.",
            answer_hi: "सोलर पैनलों का रखरखाव खर्च बहुत कम होता है, मुख्य रूप से सफाई और कभी-कभी जांच के लिए। एक पेशेवर जांच में प्रति वर्ष ₹500 से ₹1500 के बीच खर्च आ सकता है।"
        },
        what_is_a_solar_inverter: {
            keywords: ["what is a solar inverter", "solar inverter kya hota hai", "wat is solr inverer", "wht is solor invertor", "whatt is soar invertr", "hybrid solar inverter", "battery solar inverter combo", "inverer", "inverter"],
            answer_en: "A solar inverter is a device that converts the direct current (DC) electricity from solar panels into alternating current (AC) electricity that can be used by your home appliances.",
            answer_hi: "एक सोलर इन्वर्टर एक ऐसा उपकरण है जो सोलर पैनलों से आने वाली डायरेक्ट करंट (DC) बिजली को अल्टरनेटिंग करंट (AC) बिजली में परिवर्तित करता है जिसका उपयोग आपके घर के उपकरण कर सकते हैं।"
        },
        types_of_solar_inverters: {
            keywords: ["types of solar inverters", "solar inverter ke prakar", "typs of solr inverer", "type of solor invertor", "typpes of soar invertr", "inverter types"],
            answer_en: "Main types include string inverters, micro-inverters, and hybrid inverters. The choice depends on your system size and needs.",
            answer_hi: "मुख्य प्रकारों में स्ट्रिंग इन्वर्टर, माइक्रो-इन्वर्टर और हाइब्रिड इन्वर्टर शामिल हैं। चुनाव आपके सिस्टम के आकार और जरूरतों पर निर्भर करता है।"
        },
        what_is_a_solar_battery: {
            keywords: ["what is a solar battery", "solar battery kya hai", "wat is solr battry", "wht is solor batery", "whatt is soar battary", "solar btry storage capacity", "bttrey health solr system", "battry", "batery", "battery"],
            answer_en: "A solar battery is a device that stores excess electricity generated by your solar panels for later use, especially at night or during power outages.",
            answer_hi: "एक सोलर बैटरी एक ऐसा उपकरण है जो आपके सोलर पैनलों द्वारा उत्पन्न अतिरिक्त बिजली को बाद में उपयोग के लिए संग्रहीत करता है, खासकर रात में या बिजली गुल होने के दौरान।"
        },
        types_of_solar_batteries: {
            keywords: ["types of solar batteries", "solar battery ke prakar", "typs of solr battry", "type of solor batteris", "typpes of soar batries", "battery types"],
            answer_en: "Solar batteries are typically either lead-acid or lithium-ion. Lithium-ion batteries are more expensive but have a longer lifespan and better performance.",
            answer_hi: "सोलर बैटरी आमतौर पर लेड-एसिड या लिथियम-आयन होती हैं। लिथियम-आयन बैटरी अधिक महंगी होती हैं लेकिन उनकी उम्र लंबी होती है और प्रदर्शन बेहतर होता है।"
        },
        how_long_do_solar_batteries_last: {
            keywords: ["how long do solar batteries last", "solar battery kitne saal chalti hai", "hw long solr battry lst", "how lng solor batery last", "hou long soar battary lasts", "life of solr battery", "battery life"],
            answer_en: "Solar batteries typically last for 5 to 15 years, depending on the type and usage. Lithium-ion batteries have a longer lifespan than lead-acid batteries.",
            answer_hi: "सोलर बैटरी आमतौर पर 5 से 15 साल तक चलती हैं, जो उनके प्रकार और उपयोग पर निर्भर करता है। लिथियम-आयन बैटरी की उम्र लेड-एसिड बैटरी की तुलना में लंबी होती है।"
        },
        how_much_money_can_i_save: {
            keywords: ["how much money can i save with solar", "solar se kitna paisa bacha sakta hu", "kitni bachat", "hw much mony cn i sav with solr", "howmch money can i save wid solor", "hou much muny cn i sav wid soar", "how solar save electricty", "save money", "savings", "bachat"],
            answer_en: "The savings depend on your electricity consumption and the size of your solar system. Our calculator can give you an estimate of your monthly savings.",
            answer_hi: "बचत आपकी बिजली की खपत और आपके सौर ऊर्जा सिस्टम के आकार पर निर्भर करती है। हमारा कैलकुलेटर आपको आपकी मासिक बचत का अनुमान दे सकता है।"
        },
        payback_period: {
            keywords: ["payback period of solar system", "solar ka kharcha kitne saal me wapas aayega", "payback period", "paybak priod of solr systm", "payback perid of solor system", "paybak periud soar systm", "payback"],
            answer_en: "The payback period is typically 4 to 6 years, but this can vary depending on the initial cost, your electricity tariff, and available subsidies.",
            answer_hi: "रिकवरी अवधि आमतौर पर 4 से 6 साल होती है, लेकिन यह प्रारंभिक लागत, आपके बिजली टैरिफ और उपलब्ध सब्सिडी के आधार पर भिन्न हो सकती है।"
        },
        how_does_solar_help_environment: {
            keywords: ["how does solar help the environment", "solar se paryavaran ko kaise fayda", "how duz solr help enviroment", "hw dos solor hlp enviornment", "hou does soar halp envirmnt", "environment effect solar", "envmt benifits of sola", "impct of solr on envmnt", "zero emission solar", "environment", "paryavaran"],
            answer_en: "Solar energy reduces carbon emissions by using a clean, renewable energy source instead of fossil fuels. It helps combat climate change and air pollution.",
            answer_hi: "सौर ऊर्जा जीवाश्म ईंधन के बजाय एक स्वच्छ, नवीकरणीय ऊर्जा स्रोत का उपयोग करके कार्बन उत्सर्जन को कम करती है। यह जलवायु परिवर्तन और वायु प्रदूषण से लड़ने में मदद करती है।"
        },
        what_is_solar_cell_efficiency: {
            keywords: ["what is solar cell efficiency", "solar cell efficiency kya hai", "effciency of solr panel", "effcncy improvmnt tips"],
            answer_en: "Solar cell efficiency is the percentage of solar energy that a solar cell converts into usable electricity. Higher efficiency means better performance.",
            answer_hi: "सौर सेल दक्षता वह प्रतिशत है जो एक सौर सेल सौर ऊर्जा को उपयोग योग्य बिजली में परिवर्तित करता है। उच्च दक्षता का मतलब बेहतर प्रदर्शन है।"
        },
        what_is_net_metering: {
            keywords: ["what is net metering", "net metering kya hai", "wat is net metrng in solr", "wht is netmetering solor", "whatt is net mettrng in soar"],
            answer_en: "Net metering is a billing mechanism that credits solar energy system owners for the electricity they add to the power grid. It allows you to use your solar power and get credit for the surplus you generate.",
            answer_hi: "नेट मीटरिंग एक बिलिंग प्रणाली है जो सौर ऊर्जा प्रणाली के मालिकों को उनके द्वारा पावर ग्रिड में जोड़ी गई बिजली के लिए क्रेडिट देती है। यह आपको अपनी सौर ऊर्जा का उपयोग करने और आपके द्वारा उत्पन्न अतिरिक्त बिजली के लिए क्रेडिट प्राप्त करने की अनुमति देती है।"
        },
        what_factors_affect_efficiency: {
            keywords: ["what factors affect solar panel efficiency", "kaun se factor efficiency ko affect karte hain", "wat factors afect solr panal effciency", "wht factrs afct solor penel eficiency", "whatt fctors efect soar panal effishency"],
            answer_en: "Efficiency is affected by sunlight intensity, temperature, panel type, and dirt buildup. Cleaning panels regularly helps maintain efficiency.",
            answer_hi: "दक्षता सूर्य के प्रकाश की तीव्रता, तापमान, पैनल के प्रकार और धूल के जमाव से प्रभावित होती है। पैनलों को नियमित रूप से साफ करने से दक्षता बनाए रखने में मदद मिलती है।"
        },
        does_solar_work_in_rainy_season: {
            keywords: ["does solar work in rainy season", "baarish me solar kaam karta hai", "do solr wrk in rany seson", "du solor work rainy sezn", "do soar wrks in rany sezon", "can solr work in rain", "rainy season", "baarish"],
            answer_en: "Solar panels work during the rainy season, but their output is lower due to reduced sunlight. A battery backup is essential during this time.",
            answer_hi: "सौर पैनल बरसात के मौसम में काम करते हैं, लेकिन कम धूप के कारण उनका उत्पादन कम होता है। इस दौरान बैटरी बैकअप आवश्यक है।"
        },
        best_location_for_panels: {
            keywords: ["best location for solar panels", "solar panels lagane ki sabse acchi jagah", "bst locatn fr solr panals home", "best loction solor penel at hom", "besst locatn haus fr soar panal", "location"],
            answer_en: "The best location is a south-facing rooftop with no shadows from trees or buildings throughout the day.",
            answer_hi: "सबसे अच्छी जगह एक दक्षिण की ओर वाली छत है जिस पर पूरे दिन पेड़ों या इमारतों की छाया न पड़े।"
        },
        can_solar_power_a_car: {
            keywords: ["can solar power a car", "kya solar se car chala sakte hain", "cn solr pwer car", "can solor power a kar", "cann soar pwr a caar"],
            answer_en: "Yes, electric cars can be charged using solar energy, either through solar panels on a charging station or at your home.",
            answer_hi: "हाँ, इलेक्ट्रिक कारों को सौर ऊर्जा का उपयोग करके चार्ज किया जा सकता है, या तो चार्जिंग स्टेशन पर लगे सोलर पैनलों के माध्यम से या आपके घर पर।"
        },
        can_i_run_ac_on_solar: {
            keywords: ["can i run ac on solar", "kya solar se ac chala sakte hain", "cn i rn ac on solr", "can i run a/c on solor", "cann i run ac on soar"],
            answer_en: "Yes, you can run an AC on solar, but it requires a large solar system with sufficient battery backup to handle the high power consumption.",
            answer_hi: "हाँ, आप सौर ऊर्जा पर एसी चला सकते हैं, लेकिन इसके लिए उच्च बिजली की खपत को संभालने के लिए पर्याप्त बैटरी बैकअप के साथ एक बड़ी सौर प्रणाली की आवश्यकता होती है।"
        },
        solar_application: {
            keywords: ["solar application kya h", "soler aplication use", "applctns of solar enrg", "daily use of sola enrg", "use of solr in daily life", "exmples of solr device"],
            answer_en: "Solar energy is used for a wide range of applications, including heating water, generating electricity for homes and businesses, powering streetlights, and charging portable devices.",
            answer_hi: "सौर ऊर्जा का उपयोग कई अनुप्रयोगों के लिए किया जाता है, जिसमें पानी गर्म करना, घरों और व्यवसायों के लिए बिजली उत्पन्न करना, स्ट्रीटलाइट्स को बिजली देना और पोर्टेबल उपकरणों को चार्ज करना शामिल है।"
        },
        solar_appliances: {
            keywords: ["solar appliance list", "appliances work on sola", "solar box cooker kaise bnta", "solar stove kaise bnta", "solar study lamp"],
            answer_en: "Common solar appliances include solar lamps, cookers, water heaters, and refrigerators. Many home appliances like TVs and fans can also run on a solar power system.",
            answer_hi: "सामान्य सौर उपकरणों में सौर लैंप, कुकर, वॉटर हीटर और रेफ्रिजरेटर शामिल हैं। टीवी और पंखे जैसे कई घरेलू उपकरण भी सौर ऊर्जा प्रणाली पर चल सकते हैं।"
        },
        solar_project_college: {
            keywords: ["solar based project for clg", "easy solr projct for studnt", "project on solr enrg"],
            answer_en: "Some popular college projects on solar energy include solar-powered mobile chargers, solar cookers, and solar-powered smart streetlights.",
            answer_hi: "सौर ऊर्जा पर कुछ लोकप्रिय कॉलेज परियोजनाओं में सौर-ऊर्जा से चलने वाले मोबाइल चार्जर, सौर कुकर और सौर-ऊर्जा से चलने वाली स्मार्ट स्ट्रीटलाइट्स शामिल हैं।"
        },
        solar_vs_wind: {
            keywords: ["comparison solar vs wind", "diff between solar n wind"],
            answer_en: "Solar energy depends on sunlight and is quiet. Wind energy depends on wind and can be noisy. Both are renewable sources.",
            answer_hi: "सौर ऊर्जा सूरज की रोशनी पर निर्भर करती है और शांत होती है। पवन ऊर्जा हवा पर निर्भर करती है और शोरगुल वाली हो सकती है। दोनों ही नवीकरणीय स्रोत हैं।"
        },
        solar_in_rain: {
            keywords: ["can solar work in rain", "solr wrk in rany seson"],
            answer_en: "Solar panels work in the rain, but their output is lower. Rain also helps to clean the panels, which can improve efficiency later.",
            answer_hi: "सौर पैनल बारिश में काम करते हैं, लेकिन उनका उत्पादन कम होता है। बारिश पैनलों को साफ करने में भी मदद करती है, जिससे बाद में दक्षता में सुधार हो सकता है।"
        },
        solar_panel_angle: {
            keywords: ["panel angle solar setup", "y solar panel angle imp"],
            answer_en: "The angle of solar panels is crucial for maximum sunlight absorption. The best angle depends on your location and the season.",
            answer_hi: "अधिकतम सूर्य के प्रकाश को अवशोषित करने के लिए सोलर पैनलों का कोण महत्वपूर्ण है। सबसे अच्छा कोण आपके स्थान और मौसम पर निर्भर करता है।"
        },
        solar_in_space: {
            keywords: ["can solar work in space", "solr wrk in spce"],
            answer_en: "Yes, solar power works very well in space, as there is no atmosphere to block the sunlight. Satellites and spacecraft use solar panels to power their systems.",
            answer_hi: "हाँ, सौर ऊर्जा अंतरिक्ष में बहुत अच्छी तरह से काम करती है, क्योंकि सूर्य के प्रकाश को अवरुद्ध करने के लिए कोई वायुमंडल नहीं है। उपग्रह और अंतरिक्ष यान अपने सिस्टम को बिजली देने के लिए सौर पैनलों का उपयोग करते हैं।"
        },
        cost_of_system: {
            keywords: ["solar cost", "kitna kharcha", "kitna kharch", "price", "cost to install", "cost kitna", "cost", "kharcha", "price", "solar panel me kharch kitna aayega"],
            answer_en: "The cost depends on your electricity bill and the size of your roof. Our calculator can provide an estimated cost for you.",
            answer_hi: "लागत आपके बिजली के बिल और छत के आकार पर निर्भर करती है। हमारा कैलकुलेटर आपके लिए अनुमानित खर्च बता सकता है।"
        },
    },
};

function changeLanguage(lang) {
    currentLanguage = lang;
    document.querySelectorAll('[data-lang-key]').forEach(element => {
        const key = element.getAttribute('data-lang-key');
        if (translations[key] && translations[key][lang]) {
            let text = translations[key][lang];
            if (lastCalc) {
                text = text.replace('{roverDays}', lastCalc.roverDays || '');
                text = text.replace('{issSeconds}', lastCalc.issSeconds || '');
                if (lastCalc.subsidyInfo) {
                    text = text.replace('{schemeName}', lastCalc.subsidyInfo.schemeName || '');
                    text = text.replace('{subsidyAmount}', lastCalc.subsidyInfo.subsidyAmount ? lastCalc.subsidyInfo.subsidyAmount.toLocaleString() : '');
                    text = text.replace('{finalCost}', lastCalc.finalCostAfterSubsidy ? lastCalc.finalCostAfterSubsidy.toLocaleString() : '');
                }
                if (lastCalc.loanInfo) {
                    text = text.replace('{bankName}', lastCalc.loanInfo.bankName || '');
                    text = text.replace('{loanTenure}', lastCalc.loanInfo.loanTenure || '');
                    text = text.replace('{monthlyEMI}', lastCalc.loanInfo.monthlyEMI ? lastCalc.loanInfo.monthlyEMI.toFixed(0).toLocaleString() : '');
                }
            }
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = text;
            } else {
                element.innerHTML = text;
            }
        }
    });
    
    if (chart) {
        chart.data.labels = [translations['emi_label_12'][currentLanguage], translations['emi_label_24'][currentLanguage], translations['emi_label_36'][currentLanguage]];
        chart.data.datasets[0].label = translations['monthly_payment_label'][currentLanguage];
        chart.update();
    }
    if (pollutionChart) {
        pollutionChart.data.labels = [translations['pollution_remaining'][currentLanguage], translations['pollution_reduced'][currentLanguage]];
        pollutionChart.data.datasets[0].label = translations['aqi_label'][currentLanguage];
        if (lastCalc && lastCalc.aqiData) {
            pollutionChart.options.plugins.title.text = `${translations['original_aqi'][currentLanguage]}: ${lastCalc.aqiData.aqi}`;
        }
        pollutionChart.update();
    }
    
    renderMaintenanceChecklist();
    updateMaintenanceTips();

    if (document.querySelector('#solar-panels').classList.contains('active')) {
        renderSolarPanels();
    }

    if (document.querySelector('#ai-explainer').classList.contains('active') && lastCalc) {
        generateAI();
    }
    
    if (document.querySelector('#calculator').classList.contains('active') && lastCalc) {
        
        const oldUhiTip = document.querySelector('.result-stat-card[style*="grid-column: 1 / -1"]');
        if(oldUhiTip) oldUhiTip.remove();
        displayUhiTip(lastCalc.lstData);
        
        displayResults(lastCalc);
        
        displayAqiResults(lastCalc.aqiData);
    }
}

window.addEventListener('load', function() {
    if (document.querySelector('.calculator-section.active')) {
        initCalculatorMobileFixes();
    }
});
