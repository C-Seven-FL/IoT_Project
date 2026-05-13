const mongoose = require("mongoose");

const buildingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, default: "" },
    floors: { type: Number, required: true },
    status: {
      type: String,
      enum: ["OK", "WARNING", "DANGER"],
      default: "OK"
    },
    gateways: [{ type: String }]
  },
  { timestamps: true }
);

const moduleSchema = new mongoose.Schema(
  {
    moduleId: {
      type: String,
      required: true,
      unique: true
    },
    gatewayId: {
      type: String,
      required: true
    },
    building: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Building",
      required: true
    },
    floor: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ["ONLINE", "OFFLINE", "WARNING", "DANGER"],
      default: "ONLINE"
    },
    lastSeen: {
      type: Date,
      default: null
    },
    lastTemperature: {
      type: Number,
      default: null
    },
    lastAccelerometer: {
      x: { type: Number, default: null },
      y: { type: Number, default: null },
      z: { type: Number, default: null }
    }
  },
  { timestamps: true }
);

const sensorReadingSchema = new mongoose.Schema(
  {
    gatewayId: {
      type: String,
      required: true
    },
    moduleId: {
      type: String,
      required: true
    },
    building: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Building",
      required: true
    },
    floor: {
      type: Number,
      required: true
    },
    temperature: {
      type: Number,
      default: null
    },
    accelerometer: {
      x: { type: Number, default: null },
      y: { type: Number, default: null },
      z: { type: Number, default: null }
    },
    buttonPressed: {
      type: Boolean,
      default: false
    },
    measuredAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

const alertSchema = new mongoose.Schema(
  {
    building: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Building",
      required: true
    },
    gatewayId: {
      type: String,
      required: true
    },
    moduleId: {
      type: String,
      required: true
    },
    floor: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ["SOS", "FIRE", "EARTHQUAKE", "TEMPERATURE_WARNING", "DEVICE_OFFLINE"],
      required: true
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      required: true
    },
    status: {
      type: String,
      enum: ["ACTIVE", "RESOLVED"],
      default: "ACTIVE"
    },
    message: {
      type: String,
      required: true
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    // Základní info
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },

    // Role & Oprávnění (4 finální role):
    //   USER    = civil / obyvatel (vidí svoji budovu)
    //   RESCUER = záchranář (vidí všechny budovy, může řešit problémy)
    //   ADMIN   = administrátor (vytváří budovy/moduly, řeší problémy)
    //   SYSTEM  = automatizovaný účet (interní, plný přístup, např. IoT brány)
    role: {
      type: String,
      enum: ["ADMIN", "USER", "RESCUER", "SYSTEM"],
      default: "USER"
    },

    // Přiřazené budovy
    // ADMIN vidí všechny, ostatní jen svoje
    assignedBuildings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Building"
      }
    ],

    // Status
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

const Building = mongoose.model("Building", buildingSchema);
const Module = mongoose.model("Module", moduleSchema);
const SensorReading = mongoose.model("SensorReading", sensorReadingSchema);
const Alert = mongoose.model("Alert", alertSchema);
const User = mongoose.model("User", userSchema);

module.exports = {
  Building,
  Module,
  SensorReading,
  Alert,
  User
};