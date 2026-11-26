// Ember Canyon: every tunable number of the game in one place.
// Distances are metres, speeds metres per second, angles radians.
// Display units (feet, knots) are converted in hud.js.

export const CONFIG = {
  /** The seed used when the URL names none (?seed=N overrides it). */
  defaultSeed: 1,

  /** The valley runs from z = worldStart (behind the plane) to the runway. */
  worldStart: 320,
  worldEnd: -1680,

  /** The flat valley floor is |x| < valleyHalfWidth; walls rise beyond it. */
  valleyHalfWidth: 95,
  /** Canyon rim distance from the centreline. */
  rimHalfWidth: 460,
  /** How high the canyon walls rise above the floor. */
  wallHeight: 170,
  /** Gentle rolling of the valley floor itself. */
  floorBump: 3.2,

  /** How many glowing rings to thread, in order, before landing. */
  ringCount: 8,
  /** First ring's z, then one every ringSpacing metres. */
  firstRingZ: -140,
  ringSpacing: 155,
  /** A ring's inner radius: the hole the plane must fly through. */
  ringRadius: 16,
  /** A pass within this distance of the ring's centre is "dead centre". */
  deadCentreRadius: 6,

  /** The runway's centre (x, z), length along z and width along x. */
  runwayX: 0,
  runwayZ: -1480,
  runwayLength: 240,
  runwayWidth: 26,

  /** Flight model. */
  minSpeed: 16,
  maxSpeed: 78,
  /** Speed below which the plane starts to sink. */
  stallSpeed: 30,
  /** How fast the throttle moves (per second, 0..1). */
  throttleRate: 0.55,
  /** How fast pitch and roll ease toward their targets (per second). */
  pitchEase: 2.6,
  rollEase: 3.2,
  maxPitch: 0.62,
  maxRoll: 1.05,
  /** Turn rate per radian of bank (per second). */
  turnFromBank: 0.55,
  /** Hard ceiling and soft floor margin above the terrain. */
  ceiling: 175,
  crashClearance: 1.6,

  /** The sortie. */
  lives: 3,
  fuelMax: 100,
  /** Fuel burnt per second at full throttle, plus a small idle burn. */
  fuelBurnFull: 0.85,
  fuelBurnIdle: 0.12,

  /** Points. */
  ringPoints: 250,
  deadCentreBonus: 100,
  landingPoints: 1000,
  /** Bonus points per unit of fuel left on landing. */
  fuelBonusPerUnit: 5,
  /** Par time in seconds for the landing time bonus. */
  parTime: 150,

  /** Sunset palette (hex). */
  colors: {
    skyTop: 0x2c3a6e,
    skyMid: 0x7a5a9e,
    skyHorizon: 0xff9a4d,
    sun: 0xffd27a,
    fog: 0xe08a52,
    floorGrass: 0x4a6e2e,
    floorDry: 0x9a7a4a,
    wallRock: 0x8a5a44,
    wallTop: 0x6e4a5e,
    river: 0x20608f,
    riverShallow: 0x3a8ab8,
    runway: 0x2e2e34,
    ringNext: 0xffb020,
    ringDone: 0x37d67a,
    planeCream: 0xf2e3c2,
    planeOrange: 0xe86a2a,
    planeDark: 0x2c2f38,
    cloud: 0xfff2e0,
  },
};
