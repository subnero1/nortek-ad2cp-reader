import { Parser } from 'binary-parser'
import dayjs from 'dayjs'

export { parseAd2cp, toNmea }

function parseAd2cp(buffer) {
  return ad2cp.parse(buffer).records
}

const dateTime = {
  type: new Parser()
    .uint8('year')
    .uint8('month')
    .uint8('day')
    .uint8('hour')
    .uint8('minute')
    .uint8('second')
    .uint16le('frac'),
  formatter: (data) =>
    dayjs({
      year: data.year + 1900,
      month: data.month,
      day: data.day,
      hour: data.hour,
      minute: data.minute,
      second: data.second,
      millisecond: 0.1 * data.frac,
    }),
}

const errorStatus = {
  type: new Parser()
    .bit2('__skip__')
    .bit1('sensorReadFailure')
    .bit1('measurementNotFinished')
    .bit1('dataRetrievalSamplesMissing')
    .bit1('dataRetrievalUnderrun')
    .bit1('dataRetrievalOverflow')
    .bit1('dataRetrievalFifoError')
    .bit1('tagErrorBeam4QuadraturePhase')
    .bit1('tagErrorBeam4InPhase')
    .bit1('tagErrorBeam3QuadraturePhase')
    .bit1('tagErrorBeam3InPhase')
    .bit1('tagErrorBeam2QuadraturePhase')
    .bit1('tagErrorBeam2InPhase')
    .bit1('tagErrorBeam1QuadraturePhase')
    .bit1('tagErrorBeam1InPhase'),
}

const header = new Parser()
  .uint8('syncByte', { assert: 0xa5 })
  .uint8('headerSize')
  .uint8('dataSeriesId')
  .nest('dataSeriesIdLabel', {
    type: new Parser(),
    formatter: function () {
      return {
        0x15: 'Burst data as DF3',
        0x16: 'Average data as DF3',
        0x17: 'Bottom Track Data Record',
        0x18: 'Interleaved Burst Data Record (beam 5)',
        0x1e: 'Altimeter Record',
        0x1f: 'Avg Altimeter Raw Record',
        0x1a: 'Burst Altimeter Raw Record',
        0x1b: 'DVL Bottom Track Record',
        0x1c: 'Echo Sounder Record',
        0x23: 'Echo Sounder Raw Record',
        0x24: 'Echo Sounder Raw Tx Record',
        0x26: 'Average data as DF7',
        0x30: 'Processed Wave Data Record',
        0x1d: 'DVL Water Track Record',
        0xc8: 'Vector 2 data as DF8',
        0xa0: 'String Data Record',
      }[this.dataSeriesId]
    },
  })
  .uint8('familyId')
  .nest('familyIdLabel', {
    type: new Parser(),
    formatter: function () {
      return {
        0x10: 'Signature',
        0x16: 'DVL',
        0x30: 'Aquadopp Generation 2',
        0x40: 'Awac Generation 2',
      }[this.familyId]
    },
  })
  .choice('dataSize', {
    tag: 'headerSize',
    choices: {
      10: new Parser().uint16le(),
      12: new Parser().uint32le(),
    },
  })
  .uint16le('dataChecksum')
  .uint16le('headerChecksum')
const commonData = new Parser()
  .uint8('version')
  .uint8('offsetOfData')
  .seek(2)
  .uint32le('serialNumber')
  .nest('dateTime', dateTime)
  .uint16le('speedOfSound', {
    formatter: function (value) {
      return 0.1 * value
    },
  })
  .int16le('temperature', {
    formatter: function (value) {
      return 0.01 * value
    },
  })
  .uint32le('pressure')
  .uint16le('heading', {
    formatter: function (value) {
      return 0.01 * value
    },
  })
  .int16le('pitch', {
    formatter: function (value) {
      return 0.01 * value
    },
  })
  .int16le('roll', {
    formatter: function (value) {
      return 0.01 * value
    },
  })
  .seek(2)
  .uint16le('cellSize', {
    formatter: function (value) {
      return 0.001 * value
    },
  })
  .seek(2)
  .uint8('nominalCorrelation')
  .seek(1)
  .uint16le('batteryVoltage', {
    formatter: function (value) {
      return 0.1 * value
    },
  })
  .array('magnetometer', {
    type: new Parser().int16le(),
    length: 3,
  })
  .array('accelerometer', {
    type: new Parser().int16le('v', {
      formatter: function (value) {
        return (9.819 / 16384) * value
      },
    }),
    length: 3,
  })
  .seek(2)
  .uint16le('dataSetDescription')
  .uint16le('transmittedEnergy')
  .int8('velocityScaling')
  .int8('powerLevel')
  .int16le('magnetometerTemperature', {
    formatter: function (value) {
      return 0.001 * value
    },
  })
  .int16le('realTimeClockTemperature')
  .nest('errorStatus', errorStatus)
  .uint32le('ensembleCounter')
const df3CurrentProfileData = new Parser()
  .nest({ type: commonData })
  .saveOffset('__current__')
  .seek(function () {
    return this['dataStart'] - this['__current__']
  })
  .seek(2)
  .wrapped({
    length: 2,
    wrapper: (buffer) => buffer.reverse(),
    type: new Parser()
      .bit1('hasSpectrumData')
      .bit1('hasStandardDeviationData')
      .bit1('hasPercentageGoodData')
      .bit1('hasAhrsData')
      .bit1('hasEchosounderData')
      .bit1('hasAstData')
      .bit1('hasAltimeterRawData')
      .bit1('hasAltimeterData')
      .bit1('hasCorrelationData')
      .bit1('hasAmplitudeData')
      .bit1('hasVelocityData')
      .bit1('hasExternalSensor')
      .bit1('hasTiltSensor')
      .bit1('hasCompassSensor')
      .bit1('hasTemperatureSensor')
      .bit1('hasPressureSensor'),
  })
  .seek(33)
  .uint8('temperaturePressureSensor', {
    formatter: function (value) {
      return value / 5 - 4
    },
  })
  .seek(14)
  .uint16le('ambiguityVelocity', {
    formatter: function (value) {
      return 10 ** this['velocityScaling'] * value
    },
  })
  .seek(12)
  .nest('extendedStatus', {
    type: new Parser()
      .bit1('processorIdlesLessThan3Percent')
      .bit1('processorIdlesLessThan6Percent')
      .bit1('processorIdlesLessThan12Percent')
      .bit1('externalSoundVelocityProbe')
      .bit1('externalHeadingPitchRollPosition')
      .bit1('externalHeading')
      .bit1('externalPitchRoll')
      .bit1('fileSystemFlush')
      .bit1('internalProcessing')
      .bit1('extendedStatusShouldBeInterpreted'),
  })
  .uint32le('statusFlags')
  .seek(-4)
  .wrapped('status', {
    length: 4,
    wrapper: (buffer) => buffer.reverse(),
    type: new Parser()
      .bit4('wakeUpState')
      .bit3('orientation')
      .bit3('autoOrientation')
      .bit4('previousWakeupState')
      .bit1('previousMeasurementSkippedDueToLowVoltage')
      .bit1('activeConfiguration')
      .bit4('echosounderIndex', {
        formatter: function (value) {
          return value + 1
        },
      })
      .bit1('telemetryData')
      .bit1('boostRunning')
      .bit5('echosounderFrequencyBin')
      .bit3('__skip1__')
      .bit1('blankingDistanceScalingInCm')
      .bit1('__skip2__'),
    formatter: function (value) {
      return {
        ...value,
        wakeUpStateLabel: {
          0: 'bad power',
          1: 'power applied',
          2: 'break',
          3: 'RTC alarm',
        }[value.wakeUpState],
        orientationLabel: {
          0: 'XUP',
          1: 'XDOWN',
          2: 'YUP',
          3: 'YDOWN',
          4: 'ZUP',
          5: 'ZDOWN',
          7: 'AHRS',
        }[value.orientation],
        autoOrientationLabel: {
          0: 'Fixed',
          1: 'Auto',
          2: 'Auto3D',
          3: 'AHRS3D',
        }[value.autoOrientation],
        previousWakeupStateLabel: {
          0: 'bad power',
          1: 'power applied',
          2: 'break',
          3: 'RTC alarm',
        }[value.previousWakeupState],
      }
    },
  })
  .seek(-38)
  .uint16le('blankingDistance', {
    formatter: function (value) {
      return value * (this['status']['blankingDistanceScalingInCm'] ? 0.01 : 0.001)
    },
  })
const df3EchosounderData = new Parser()
  .nest({ type: df3CurrentProfileData })
  .saveOffset('__current__')
  .seek(function () {
    return this['dataStart'] - this['__current__']
  })
  .seek(30)
  .uint16le('numberOfCells')
  .seek(20)
  .uint16le('echosounderFrequency')
  .seek(function () {
    return this['offsetOfData'] - 54
  })
  .array('echosounderData', {
    type: new Parser().uint16le('v', {
      formatter: function (value) {
        return 0.01 * value
      },
    }),
    length: function () {
      return this['numberOfCells']
    },
  })
const echosounderRawData = new Parser()
  .uint8('version')
  .uint8('offsetOfData')
  .nest('dateTime', dateTime)
  .nest('errorStatus', errorStatus)
  .wrapped('status', {
    length: 4,
    wrapper: (buffer) => buffer.reverse(),
    type: new Parser()
      .bit4('wakeUpState')
      .bit3('orientation')
      .bit3('autoOrientation')
      .bit4('previousWakeupState')
      .bit1('lastMeasurementLowVoltageSkip')
      .bit1('activeConfiguration')
      .bit4('echoIndex', {
        formatter: function (value) {
          return `FREQ${value + 1}`
        },
      })
      .bit1('telemetryData')
      .bit1('boostRunning')
      .bit5('echoFrequencyBin')
      .bit3('__skip1__')
      .bit1('blankingDistanceScalingInCm')
      .bit1('__skip2__'),
    formatter: function (value) {
      return {
        ...value,
        wakeUpStateLabel: {
          0: 'bad power',
          1: 'power applied',
          2: 'break',
          3: 'RTC alarm',
        }[value.wakeUpState],
        orientationLabel: {
          0: 'XUP',
          1: 'XDOWN',
          2: 'YUP',
          3: 'YDOWN',
          4: 'ZUP',
          5: 'ZDOWN',
          7: 'AHRS',
        }[value.orientation],
        autoOrientationLabel: {
          0: 'Fixed',
          1: 'Auto',
          2: 'Auto3D',
          3: 'AHRS3D',
        }[value.autoOrientation],
        previousWakeupStateLabel: {
          0: 'bad power',
          1: 'power applied',
          2: 'break',
          3: 'RTC alarm',
        }[value.previousWakeupState],
      }
    },
  })
  .uint32le('serialNumber')
  .uint32le('numberOfSamples')
  .uint32le('startSampleIndex')
  .floatle('samplingRate')
  .seek(function () {
    return this['offsetOfData'] - 28
  })
  .array('echosounderRawData', {
    type: new Parser().int32le(),
    length: function () {
      return 2 * this['numberOfSamples']
    },
  })
const df3VelocityData = new Parser()
  .nest({ type: df3CurrentProfileData })
  .saveOffset('__current__')
  .seek(function () {
    return this['dataStart'] - this['__current__']
  })
  .seek(30)
  .wrapped({
    length: 2,
    wrapper: (buffer) => buffer.reverse(),
    type: new Parser().bit4('numberOfBeams').bit2('coordinateSystem').bit10('numberOfCells'),
    formatter: function (value) {
      return {
        ...value,
        coordinateSystemLabel: {
          0: 'ENU',
          1: 'XYZ',
          2: 'BEAM',
          3: 'not used',
        }[value.coordinateSystem],
      }
    },
  })
  .saveOffset('__current__')
  .seek(function () {
    return this['dataStart'] + this['offsetOfData'] - this['__current__']
  })
  .choice({
    // Undocumented. This seems to work for the listed record types...
    tag: 'dataSeriesId',
    choices: {
      0x16: new Parser(),
      0x18: new Parser(),
      0x15: new Parser().floatle('stmDataScattering').floatle('stmDataHighRange'),
      0x1a: new Parser().floatle('stmDataScattering').floatle('stmDataHighRange'),
    },
  })
  .array('velocityData', {
    type: new Parser().int16le(),
    length: function () {
      return (
        this['numberOfBeams'] *
        this['numberOfCells'] *
        this['hasVelocityData'] *
        this['hasCorrelationData']
      )
    },
    formatter: function (values) {
      return values.map((value) => value * 10 ** this['velocityScaling'])
    },
  })
  .array('amplitudeData', {
    type: new Parser().uint8(),
    length: function () {
      return (
        this['numberOfBeams'] *
        this['numberOfCells'] *
        this['hasAmplitudeData'] *
        this['hasCorrelationData']
      )
    },
    formatter: function (values) {
      return values.map((value) => 0.5 * value)
    },
  })
  .array('correlationData', {
    type: new Parser().uint8(),
    length: function () {
      return this['numberOfBeams'] * this['numberOfCells'] * this['hasCorrelationData']
    },
  })
  .choice('altimeterData', {
    tag: function () {
      return this['hasAltimeterData']
    },
    choices: {
      0: new Parser(),
      1: new Parser().floatle('altimeter').uint16le('altimeterQuality').uint16le('altimeterStatus'),
    },
  })
  .choice('astData', {
    tag: function () {
      return this['hasAstData']
    },
    choices: {
      0: new Parser(),
      1: new Parser()
        .floatle('astDistance')
        .uint16le('astQuality')
        .int16le('astOffset')
        .floatle('astPressure'),
    },
  })
  .choice('altimeterRawData', {
    tag: function () {
      return this['hasAltimeterRawData']
    },
    choices: {
      0: new Parser(),
      1: new Parser()
        .uint32le('numRawSamples')
        .uint16le('samplesDistance', {
          formatter: function (value) {
            return 1e-4 * value
          },
        })
        .array('dataSamples', {
          type: new Parser().int16le(),
          length: function () {
            return this['numRawSamples']
          },
        }),
    },
  })
  .choice('ahrsData', {
    tag: function () {
      return this['hasAhrsData']
    },
    choices: {
      0: new Parser(),
      1: new Parser()
        .array('rotationMatrix', {
          type: new Parser().floatle(),
          length: 9,
        })
        .array('quaternion', {
          type: new Parser().floatle(),
          length: 4,
        })
        .array('gyro', {
          type: new Parser().floatle(),
          length: 3,
        }),
    },
  })
  .array('percentageGoodData', {
    type: new Parser().uint8(),
    length: function () {
      return this['numberOfCells'] * this['hasPercentageGoodData']
    },
  })
  .choice('standardDeviationData', {
    tag: function () {
      return this['hasStandardDeviationData']
    },
    choices: {
      0: new Parser(),
      1: new Parser()
        .int16le('pitch', {
          formatter: function (value) {
            return 1e-2 * value
          },
        })
        .int16le('roll', {
          formatter: function (value) {
            return 1e-2 * value
          },
        })
        .int16le('heading', {
          formatter: function (value) {
            return 1e-2 * value
          },
        })
        .int16le('pressure', {
          formatter: function (value) {
            return 1e-3 * value
          },
        }),
    },
  })
const df3SpectrumData = new Parser()
  .nest({ type: df3CurrentProfileData })
  .saveOffset('__current__')
  .seek(function () {
    return this['dataStart'] - this['__current__']
  })
  .seek(30)
  .wrapped({
    length: 2,
    wrapper: (buffer) => buffer.reverse(),
    type: new Parser().bit3('numberOfBeams').bit13('numberOfBins'),
  })
  .saveOffset('__current__')
  .seek(function () {
    return this['dataStart'] + this['offsetOfData'] - this['__current__']
  })
  .seek(56)
  .choice('SpectrumData', {
    tag: function () {
      return this['hasSpectrumData']
    },
    choices: {
      0: new Parser(),
      1: new Parser()
        .floatle('startFrequency')
        .floatle('stepFrequency')
        .array('bins', {
          type: new Parser().int16le(),
          length: function () {
            return this.$parent['numberOfBeams'] * this.$parent['numberOfBins']
          },
        }),
    },
  })
const waveData = new Parser()
  .uint8('version')
  .uint8('offsetOfData')
  .wrapped({
    length: 2,
    wrapper: (buffer) => buffer.reverse(),
    type: new Parser()
      .bit11('__skip__')
      .bit1('hasWaveDirectionSpectra')
      .bit1('hasFourierSpectra')
      .bit1('hasWaveBand')
      .bit1('hasEnergySpectra')
      .bit1('hasWaveParameters'),
  })
  .uint32le('serialNumber')
  .nest('dateTime', dateTime)
  .uint16le('waveCounter')
  .uint32le('errorFlags')
  .nest('error', {
    type: new Parser()
      .bit1('noPressure')
      .bit1('lowPressure')
      .bit1('lowAmp')
      .bit1('whiteNoise')
      .bit1('unreasonableEstimation')
      .bit1('neverProcessed')
      .bit1('astOutOfBound')
      .bit1('directionAmbiguity')
      .bit1('noPressurePeak')
      .bit1('closeToClip')
      .bit1('astHeightLoss')
      .bit1('highTilt')
      .bit1('correlation')
      .bit19('__skip__'),
  })
  .nest('status', {
    type: new Parser().bit16('__skip1__').bit1('activeConfiguration').bit15('__skip2__'),
  })
  .uint8('spectrumType')
  .nest('spectrumTypeLabel', {
    type: new Parser(),
    formatter: function () {
      // prettier-ignore
      return {
        0: 'Pressure',
        1: 'Velocity',
        2: 'Auto depth',
        3: 'AST only',
      }[this.spectrumType]
    },
  })
  .uint8('processingMethod')
  .nest('processingMethodLabel', {
    type: new Parser(),
    formatter: function () {
      // prettier-ignore
      return {
        2: 'SUV',
        4: 'MLMST',
      }[this.processingMethod]
    },
  })
  .uint8('targetCell')
  .seek(1)
  .uint16le('numberOfNoDetects')
  .uint16le('numberOfBadDetects')
  .floatle('cutOffFrequency')
  .floatle('processingTime')
  .uint16le('numberOfZeroCrossings')
  .string('versionString', { length: 4 })
  .seek(54)
  .saveOffset('__current__')
  .seek(function () {
    return this['dataStart'] + this['offsetOfData'] - this['__current__']
  })
  .choice('waveData', {
    tag: function () {
      return this['hasWaveParameters']
    },
    choices: {
      0: new Parser(),
      1: new Parser()
        .floatle('height0')
        .floatle('height3')
        .floatle('height10')
        .floatle('heightMax')
        .floatle('heightMean')
        .floatle('periodMean')
        .floatle('periodPeak')
        .floatle('periodZ')
        .floatle('period1d3')
        .floatle('period1d10')
        .floatle('periodMax')
        .floatle('periodEnergy')
        .floatle('directionAtPeakPeriod')
        .floatle('spreadingAtPeakPeriod')
        .floatle('waveDirectionMean')
        .floatle('unidirectivityIndex')
        .floatle('pressureMean')
        .floatle('currentSpeedMean')
        .floatle('currentDirectionMean')
        .floatle('astMeanDistance')
        .seek(20),
    },
  })
  .choice('swellWaves', {
    tag: function () {
      return this['hasWaveBand']
    },
    choices: {
      0: new Parser(),
      1: new Parser()
        .floatle('lowFrequency')
        .floatle('highFrequency')
        .floatle('height0')
        .floatle('periodMean')
        .floatle('periodPeak')
        .floatle('directionAtPeakPeriod')
        .floatle('waveDirectionMean')
        .floatle('spreadingAtPeakPeriod')
        .seek(20),
    },
  })
  .choice('seaWaves', {
    tag: function () {
      return this['hasWaveBand']
    },
    choices: {
      0: new Parser(),
      1: new Parser()
        .floatle('lowFrequency')
        .floatle('highFrequency')
        .floatle('height0')
        .floatle('periodMean')
        .floatle('periodPeak')
        .floatle('directionAtPeakPeriod')
        .floatle('waveDirectionMean')
        .floatle('spreadingAtPeakPeriod')
        .seek(20),
    },
  })
  .choice('energySpectrum', {
    tag: function () {
      return this['hasEnergySpectra']
    },
    choices: {
      0: new Parser(),
      1: new Parser()
        .floatle('lowFrequency')
        .floatle('highFrequency')
        .floatle('stepFrequency')
        .uint16le('nBins')
        .seek(22)
        .array('data', {
          type: new Parser().floatle(),
          length: 'nBins',
        }),
    },
  })
  .choice('fourierCoefficients', {
    tag: function () {
      return this['hasFourierSpectra']
    },
    choices: {
      0: new Parser(),
      1: new Parser()
        .floatle('lowFrequency')
        .floatle('highFrequency')
        .floatle('stepFrequency')
        .uint16le('nBins')
        .seek(22)
        .array('data', {
          type: new Parser().floatle(),
          length: function () {
            return 4 * this['nBins']
          },
        }),
    },
  })
  .choice('direction', {
    tag: function () {
      return this['hasWaveDirectionSpectra']
    },
    choices: {
      0: new Parser(),
      1: new Parser()
        .floatle('lowFrequency')
        .floatle('highFrequency')
        .floatle('stepFrequency')
        .uint16le('nBins')
        .seek(22)
        .array('data', {
          type: new Parser().floatle(),
          length: function () {
            return 2 * this['nBins']
          },
        }),
    },
  })
const ad2cp = new Parser().useContextVars().array('records', {
  type: new Parser()
    .nest({ type: header })
    .saveOffset('dataStart')
    .choice({
      tag: 'dataSeriesId',
      choices: {
        0x1c: df3EchosounderData,
        0x23: echosounderRawData,
        0x24: echosounderRawData,
        0x15: df3VelocityData,
        0x16: df3VelocityData,
        0x18: df3VelocityData,
        0x1e: df3VelocityData,
        0x1a: df3VelocityData,
        0x1f: df3VelocityData,
        0x20: df3SpectrumData,
        0x30: waveData,
        0xa0: new Parser().string('data', { length: 'dataSize' }),
      },
      defaultChoice: new Parser(),
    })
    .saveOffset('__current__')
    .seek(function () {
      const n = this['dataStart'] + this['dataSize'] - this['__current__']
      if (n != 0) {
        console.warn(`Did not consume whole record: skipping ${n} bytes`, this)
      }
      return n
    }),
  readUntil: 'eof',
})

function toNmea(data, types) {
  types = types.map((type) => type.toUpperCase())
  const sentences = []
  for (const record of data) {
    // Average
    if (record.dataSeriesId == 0x16) {
      for (const type of ['PNORI', 'PNORI1', 'PNORI2']) {
        if (types.includes(type)) {
          const tag = type === 'PNORI2'
          sentences.push([
            type,
            (tag ? 'IT=' : '') +
              {
                Signature: 4,
                'Aquadopp Generation 2': 0, // undocumented
                'Awac Generation 2': 2, // undocumented
              }[record.familyIdLabel],
            (tag ? 'SN=' : '') + record.serialNumber,
            (tag ? 'NB=' : '') + record.numberOfBeams,
            (tag ? 'NC=' : '') + record.numberOfCells,
            (tag ? 'BD=' : '') + record.blankingDistance.toFixed(2),
            (tag ? 'CS=' : '') + record.cellSize.toFixed(2),
            (tag ? 'CY=' : '') +
              (type === 'PNORI' ? record.coordinateSystem : record.coordinateSystemLabel),
          ])
        }
      }
      for (const type of ['PNORS', 'PNORS1', 'PNORS2']) {
        if (types.includes(type)) {
          const tag = type === 'PNORS2'
          let sentence = [
            type,
            (tag ? 'DATE=' : '') + record.dateTime.format('MMDDYY'),
            (tag ? 'TIME=' : '') + record.dateTime.format('HHmmss'),
            (tag ? 'EC=' : '') + '0',
            (tag ? 'SC=' : '') + record.statusFlags.toString(16).toUpperCase().padStart(8, '0'),
            (tag ? 'BV=' : '') + record.batteryVoltage.toFixed(1),
            (tag ? 'SS=' : '') + record.speedOfSound.toFixed(1),
            (tag ? 'HSD=' : '') + record.standardDeviationData.heading.toFixed(2),
            (tag ? 'H=' : '') + record.heading.toFixed(1),
            (tag ? 'PI=' : '') + record.pitch.toFixed(1),
            (tag ? 'PISD=' : '') + record.standardDeviationData.pitch.toFixed(2),
            (tag ? 'R=' : '') + record.roll.toFixed(1),
            (tag ? 'RSD=' : '') + record.standardDeviationData.roll.toFixed(2),
            (tag ? 'P=' : '') + record.pressure.toFixed(3),
            (tag ? 'PSD=' : '') + record.standardDeviationData.pressure.toFixed(2),
            (tag ? 'T=' : '') + record.temperature.toFixed(2),
          ]
          if (type === 'PNORS') {
            sentence = sentence.filter((_, index) => ![7, 10, 12, 14].includes(index))
          }
          sentences.push(sentence)
        }
      }
      for (const type of ['PNORC', 'PNORC1', 'PNORC2']) {
        if (types.includes(type)) {
          const tag = type === 'PNORC2'
          let velocityTags = ['', '', '', '']
          if (tag) {
            if (record.coordinateSystemLabel === 'ENU') {
              velocityTags = ['VE=', 'VN=', 'VU=', 'VU2=']
            }
            if (record.coordinateSystemLabel === 'XYZ') {
              velocityTags = ['VX=', 'VY=', 'VZ=', 'VZ2=']
            }
            if (record.coordinateSystemLabel === 'BEAM') {
              velocityTags = ['V1=', 'V2=', 'V3=', 'V4=']
            }
          }
          for (let i = 0; i < record.numberOfCells; i++) {
            let sentence = [
              type,
              (tag ? 'DATE=' : '') + record.dateTime.format('MMDDYY'),
              (tag ? 'TIME=' : '') + record.dateTime.format('HHmmss'),
              (tag ? 'CN=' : '') + (i + 1).toString(),
              (tag ? 'CP=' : '') + (record.blankingDistance + (i + 1) * record.cellSize).toFixed(1),
              velocityTags[0] + record.velocityData[0 * record.numberOfCells + i].toFixed(3),
              velocityTags[1] + record.velocityData[1 * record.numberOfCells + i].toFixed(3),
              velocityTags[2] + record.velocityData[2 * record.numberOfCells + i].toFixed(3),
              velocityTags[3] +
                (record.numberOfBeams == 4
                  ? record.velocityData[3 * record.numberOfCells + i]
                  : 0
                ).toFixed(3),
              0, // "Speed" in PNORC. Unclear what that's supposed to be.
              0, // "Direction" in PNORC. Unclear what that's supposed to be.
              (tag ? 'A1=' : '') + record.amplitudeData[0 * record.numberOfCells + i].toFixed(1),
              (tag ? 'A2=' : '') + record.amplitudeData[1 * record.numberOfCells + i].toFixed(1),
              (tag ? 'A3=' : '') + record.amplitudeData[2 * record.numberOfCells + i].toFixed(1),
              (tag ? 'A4=' : '') +
                (record.numberOfBeams == 4
                  ? record.amplitudeData[3 * record.numberOfCells + i]
                  : 0
                ).toFixed(1),
              (tag ? 'C1=' : '') + record.correlationData[0 * record.numberOfCells + i],
              (tag ? 'C2=' : '') + record.correlationData[1 * record.numberOfCells + i],
              (tag ? 'C3=' : '') + record.correlationData[2 * record.numberOfCells + i],
              (tag ? 'C4=' : '') +
                (record.numberOfBeams == 4
                  ? record.correlationData[3 * record.numberOfCells + i]
                  : 0),
            ]
            if (type === 'PNORC') {
              sentence = sentence.filter((_, index) => ![4].includes(index))
            } else {
              sentence = sentence.filter((_, index) => ![9, 10].includes(index))
            }
            sentences.push(sentence)
          }
        }
      }
    }

    // Wave
    if (record.dataSeriesId == 0x30) {
      if (types.includes('PNORW')) {
        sentences.push([
          'PNORW',
          record.dateTime.format('MMDDYY'),
          record.dateTime.format('HHmmss'),
          record.spectrumType,
          record.processingMethod,
          record.waveData.height0.toFixed(2),
          record.waveData.height3.toFixed(2),
          record.waveData.height10.toFixed(2),
          record.waveData.heightMax.toFixed(2),
          record.waveData.periodMean.toFixed(2),
          record.waveData.periodPeak.toFixed(2),
          record.waveData.periodZ.toFixed(2),
          record.waveData.directionAtPeakPeriod.toFixed(2),
          record.waveData.spreadingAtPeakPeriod.toFixed(2),
          record.waveData.waveDirectionMean.toFixed(2),
          record.waveData.unidirectivityIndex.toFixed(2),
          record.waveData.pressureMean.toFixed(2),
          record.numberOfNoDetects,
          record.numberOfBadDetects,
          record.waveData.currentSpeedMean.toFixed(2),
          record.waveData.currentDirectionMean.toFixed(2),
          record.errorFlags.toString(16).toUpperCase().padStart(4, '0'),
        ])
      }
      if (types.includes('PNORB')) {
        sentences.push([
          'PNORB',
          record.dateTime.format('MMDDYY'),
          record.dateTime.format('HHmmss'),
          record.spectrumType,
          record.processingMethod,
          record.swellWaves.lowFrequency.toFixed(2),
          record.swellWaves.highFrequency.toFixed(2),
          record.swellWaves.height0.toFixed(2),
          record.swellWaves.periodMean.toFixed(2),
          record.swellWaves.periodPeak.toFixed(2),
          record.swellWaves.directionAtPeakPeriod.toFixed(2),
          record.swellWaves.spreadingAtPeakPeriod.toFixed(2),
          record.swellWaves.waveDirectionMean.toFixed(2),
          '0000', // undocumented
        ])
        sentences.push([
          'PNORB',
          record.dateTime.format('MMDDYY'),
          record.dateTime.format('HHmmss'),
          record.spectrumType,
          record.processingMethod,
          record.seaWaves.lowFrequency.toFixed(2),
          record.seaWaves.highFrequency.toFixed(2),
          record.seaWaves.height0.toFixed(2),
          record.seaWaves.periodMean.toFixed(2),
          record.seaWaves.periodPeak.toFixed(2),
          record.seaWaves.directionAtPeakPeriod.toFixed(2),
          record.seaWaves.spreadingAtPeakPeriod.toFixed(2),
          record.seaWaves.waveDirectionMean.toFixed(2),
          '0000', // undocumented
        ])
      }
      if (types.includes('PNORE')) {
        sentences.push([
          'PNORE',
          record.dateTime.format('MMDDYY'),
          record.dateTime.format('HHmmss'),
          record.spectrumType,
          record.energySpectrum.lowFrequency.toFixed(2),
          record.energySpectrum.stepFrequency.toFixed(2),
          record.energySpectrum.nBins,
          ...record.energySpectrum.data.map((value) => (value * 1e-4).toFixed(3)),
          //                                                    ^^^^ undocumented
        ])
      }
      if (types.includes('PNORF')) {
        for (const [flagIndex, flag] of ['A1', 'B1', 'A2', 'B2'].entries()) {
          sentences.push([
            'PNORF',
            flag,
            record.dateTime.format('MMDDYY'),
            record.dateTime.format('HHmmss'),
            record.spectrumType,
            record.fourierCoefficients.lowFrequency.toFixed(2),
            record.fourierCoefficients.stepFrequency.toFixed(2),
            record.fourierCoefficients.nBins,
            ...record.fourierCoefficients.data
              .slice(
                flagIndex * record.fourierCoefficients.nBins,
                (flagIndex + 1) * record.fourierCoefficients.nBins,
              )
              .map((value) => value.toFixed(4)),
          ])
        }
      }
      if (types.includes('PNORWD')) {
        for (const [flagIndex, flag] of ['MD', 'DS'].entries()) {
          sentences.push([
            'PNORWD',
            flag,
            record.dateTime.format('MMDDYY'),
            record.dateTime.format('HHmmss'),
            record.spectrumType,
            record.direction.lowFrequency.toFixed(2),
            record.direction.stepFrequency.toFixed(2),
            record.direction.nBins,
            ...record.direction.data
              .slice(flagIndex * record.direction.nBins, (flagIndex + 1) * record.direction.nBins)
              .map((value) => value.toFixed(4)),
          ])
        }
      }
    }
  }

  return sentences
    .map((fields) => {
      const sentence = fields.join(',')
      const checksum = new TextEncoder()
        .encode(sentence)
        .reduce((a, b) => a ^ b)
        .toString(16)
        .toUpperCase()
        .padStart(2, '0')
      return `$${sentence}*${checksum}`
    })
    .join('\n')
}
