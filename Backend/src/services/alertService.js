const { Alert, Module, Building } = require("../models");

class AlertService {
  // Prahové hodnoty podle dokumentace
  static THRESHOLDS = {
    TEMPERATURE: { WARNING: 45, CRITICAL: 70 },
    ACCELEROMETER: { WARNING: 1.5, CRITICAL: 3.0 }
  };

  static async processTelemetry(telemetryData) {
    const { gatewayId, moduleId, building, floor, temperature, accelerometer, buttonPressed } = telemetryData;

    try {
      // 1. SOS Tlačítko
      if (buttonPressed) {
        await this.createAlert({ building, gatewayId, moduleId, floor, type: "SOS", severity: "CRITICAL", message: `SOS aktivováno na modulu ${moduleId}` });
      }

      // 2. Teplota
      if (temperature !== null && temperature !== undefined) {
        if (temperature >= this.THRESHOLDS.TEMPERATURE.CRITICAL) {
          await this.createAlert({ building, gatewayId, moduleId, floor, type: "FIRE", severity: "CRITICAL", message: `KRITICKÁ TEPLOTA: ${temperature}°C na ${moduleId}` });
        } else if (temperature >= this.THRESHOLDS.TEMPERATURE.WARNING) {
          await this.createAlert({ building, gatewayId, moduleId, floor, type: "TEMPERATURE_WARNING", severity: "HIGH", message: `Zvýšená teplota: ${temperature}°C na ${moduleId}` });
        }
      }

      // 3. Akcelerometr (Zemětřesení/Narušení)
      if (telemetryData.accelerometerAlarm) {
        await this.createAlert({ building, gatewayId, moduleId, floor, type: "EARTHQUAKE", severity: "CRITICAL", message: `Otřes detekován: hardwarový alarm na modulu ${moduleId}` });
      }

      // 4. Aktualizace statusů
      await this.updateModuleStatus(moduleId, building);
      await this.updateBuildingStatus(building);

      return { success: true };
    } catch (error) {
      console.error("Error processing telemetry:", error);
      throw error;
    }
  }

  static async createAlert(alertData) {
    const existingAlert = await Alert.findOne({ moduleId: alertData.moduleId, type: alertData.type, status: "ACTIVE" });
    if (existingAlert) return; // Zamezení duplicit
    await Alert.create({ ...alertData, status: "ACTIVE", resolvedAt: null });
  }

  static async updateModuleStatus(moduleId, buildingId) {
    const activeAlerts = await Alert.find({ moduleId, status: "ACTIVE" });
    let newStatus = "ONLINE";
    for (const alert of activeAlerts) {
      if (alert.severity === "CRITICAL") { newStatus = "DANGER"; break; }
      else if (alert.severity === "HIGH") { newStatus = "WARNING"; }
    }
    await Module.findOneAndUpdate({ moduleId }, { status: newStatus, lastSeen: new Date() });
  }

  static async updateBuildingStatus(buildingId) {
    const activeAlerts = await Alert.find({ building: buildingId, status: "ACTIVE" });
    let newStatus = "OK";
    if (activeAlerts.length > 0) {
      const hasCritical = activeAlerts.some(a => a.severity === "CRITICAL");
      newStatus = hasCritical ? "DANGER" : "WARNING";
    }
    await Building.findByIdAndUpdate(buildingId, { status: newStatus });
  }

  static async resolveAlert(alertId) {
    const alert = await Alert.findByIdAndUpdate(alertId, { status: "RESOLVED", resolvedAt: new Date() }, { new: true });
    if (alert) {
      await this.updateModuleStatus(alert.moduleId, alert.building);
      await this.updateBuildingStatus(alert.building);
    }
    return alert;
  }
}

module.exports = AlertService;
