import { Parser } from 'binary-parser';
import dayjs from 'dayjs';

const dateTime = {
  type: new Parser()
    .uint8('year')
    .uint8('month')
    .uint8('day')
    .uint8('hour')
    .uint8('minute')
    .uint8('second')
    .uint16le('frac')
    ,
  formatter: (data) => dayjs({
    year: data.year + 1900,
    month: data.month, 
    day: data.day,
    hour: data.hour,
    minute: data.minute,
    second: data.second,
    millisecond: 0.1 * data.frac,
  })
};

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
    .bit1('tagErrorBeam1InPhase')
};

const header = new Parser()
  .uint8('syncByte', { assert: 0xa5 })
  .uint8('headerSize')
  .uint8('dataSeriesId')
  .uint8(
    'familyId',
    {
      formatter: function(value) {
        switch (value) {
          case 0x10: return 'Signature';
          case 0x16: return 'DVL';
          case 0x30: return 'Aquadopp Generation 2';
          case 0x40: return 'Awac Generation 2';
          default: return 'unknown';
        }
      }
    }
  )
  .choice(
    'dataSize',
    {
      tag: 'headerSize',
      choices: {
        10: new Parser().uint16le(),
        12: new Parser().uint32le()
      }
    },
  )
  .uint16le('dataChecksum')
  .uint16le('headerChecksum')
;

const commonData = new Parser()
  .uint8('version')
  .uint8('offsetOfData')
  .seek(2)
  .uint32le('serialNumber')
  .nest('dateTime', dateTime)
  .uint16le('speedOfSound', { formatter: function(value) { return 0.1 * value } })
  .int16le('temperature', { formatter: function(value) { return 0.01 * value } })
  .uint32le('pressure')
  .uint16le('heading', { formatter: function(value) { return 0.01 * value } })
  .int16le('pitch', { formatter: function(value) { return 0.01 * value } })
  .int16le('roll', { formatter: function(value) { return 0.01 * value } })
  .seek(2)
  .uint16le('cellSize', { formatter: function(value) { return 0.001 * value } })
  .seek(2)
  .uint8('nominalCorrelation')
  .seek(1)
  .uint16le('batteryVoltage', { formatter: function(value) { return 0.1 * value } })
  .array(
    'magnetometer',
    {
      type: new Parser().int16le(),
      length: 3
    }
  )
  .array(
    'accelerometer',
    {
      type: new Parser().int16le('v', { formatter: function(value) { return 9.819/16384 * value } }),
      length: 3
    }
  )
  .seek(2)
  .uint16le('dataSetDescription')
  .uint16le('transmittedEnergy')
  .int8('velocityScaling')
  .int8('powerLevel')
  .int16le('magnetometerTemperature', { formatter: function(value) { return 0.001 * value } })
  .int16le('realTimeClockTemperature')
  .nest('errorStatus', errorStatus)
  .uint32le('ensembleCounter')
;

const df3CurrentProfileData = new Parser()
  .nest({ type: commonData })
  .saveOffset('__current__')
  .seek(function() { return this['dataStart'] - this['__current__'] })
  .seek(2)
  .wrapped({
      length: 2,
      wrapper: buffer => buffer.reverse(),
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
        .bit1('hasPressureSensor')
    }
  )
  .seek(33)
  .uint8('temperaturePressureSensor', { formatter: function(value) { return value/5 - 4 } })
  .seek(14)
  .uint16le('ambiguityVelocity', { formatter: function(value) { return 10 ** this['velocityScaling'] * value } })
  .seek(12)
  .nest(
    'extendedStatus',
    { 
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
        .bit1('extendedStatusShouldBeInterpreted')
    }
  )
  .wrapped(
    'status', 
    {
      length: 4, 
      wrapper: buffer => buffer.reverse(),
      type: new Parser()
        .bit4(
          'wakeUpState',
          {
            formatter: function(value) {
              switch (value) {
                case 0: return 'bad power';
                case 1: return 'power applied';
                case 2: return 'break';
                case 3: return 'RTC alarm';
                default: return 'unknown';
              }
            }
          }
        )
        .bit3(
          'orientation',
          {
            formatter: function(value) {
              switch (value) {
                case 0: return 'XUP';
                case 1: return 'XDOWN';
                case 2: return 'YUP';
                case 3: return 'YDOWN';
                case 4: return 'ZUP';
                case 5: return 'ZDOWN';
                case 7: return 'AHRS';
                default: return 'unknown';
              }
            }
          }
        )
        .bit3(
          'autoOrientation',
          {
            formatter: function(value) {
              switch (value) {
                case 0: return 'Fixed';
                case 1: return 'Auto';
                case 3: return 'AHRS3D';
                default: 'unknown'
              }
            }
          }
        )
        .bit4(
          'previousWakeupState',
          {
            formatter: function(value) {
              switch (value) {
                case 0: return 'bad power';
                case 1: return 'power applied';
                case 2: return 'break';
                case 3: return 'RTC alarm';
                default: return 'unknown';
              }
            }
          }
        )
        .bit1('previousMeasurementSkippedDueToLowVoltage')
        .bit1('activeConfiguration')
        .bit4('echosounderIndex', { formatter: function(value) { return value + 1 } })
        .bit1('telemetryData')
        .bit1('boostRunning')
        .bit5('echosounderFrequencyBin')
        .bit3('__skip1__')
        .bit1('blankingDistanceScalingInCm')
        .bit1('__skip2__')
    }
  )
  .seek(-36)
  .uint16le(
    'blankingDistance',
    { formatter: function(value) { return value * (this['blankingDistanceScalingInCm'] ? 0.01 : 0.001) } }
  )
;

const df3EchosounderData = new Parser()
  .nest({ type: df3CurrentProfileData })
  .saveOffset('__current__')
  .seek(function() { return this['dataStart'] - this['__current__'] })
  .seek(30)
  .uint16le('numberOfCells')
  .seek(20)
  .uint16le('echosounderFrequency')
  .seek(function() { return this['offsetOfData'] - 54 })
  .array(
    'echosounderData',
    {
      type: new Parser().uint16le('v', { formatter: function(value) { return 0.01 * value } }),
      length: function() { return this['numberOfCells'] }
    }
  )
;

const echosounderRawData = new Parser()
  .uint8('version')
  .uint8('offsetOfData')
  .nest('dateTime', dateTime)
  .nest('errorStatus', errorStatus)
  .wrapped(
    'status', 
    {
      length: 4, 
      wrapper: buffer => buffer.reverse(),
      type: new Parser()
        .bit4(
          'wakeUpState',
          {
            formatter: function(value) {
              switch (value) {
                case 0: return 'bad power';
                case 1: return 'power applied';
                case 2: return 'break';
                case 3: return 'RTC alarm';
                default: return 'unknown';
              }
            }
          }
        )
        .bit3(
          'orientation',
          {
            formatter: function(value) {
              switch (value) {
                case 4: return "UP"
                case 5: return "DOWN"
                case 7: return 'AHRS';
                default: return 'unknown';
              }
            }
          }
        )
        .bit3(
          'autoOrientation',
          {
            formatter: function(value) {
              switch (value) {
                case 0: return 'Fixed';
                case 1: return 'Auto';
                case 2: return 'Auto3D';
                case 3: return 'AHRS3D';
              }
            }
          }
        )
        .bit4(
          'previousWakeupState',
          {
            formatter: function(value) {
              switch (value) {
                case 0: return 'bad power';
                case 1: return 'power applied';
                case 2: return 'break';
                case 3: return 'RTC alarm';
                default: return 'unknown';
              }
            }
          }
        )
        .bit1('lastMeasurementLowVoltageSkip')
        .bit1('activeConfiguration')
        .bit4('echoIndex', { formatter: function(value) { return `FREQ${value+1}` } })
        .bit1('telemetryData')
        .bit1('boostRunning')
        .bit5('echoFrequencyBin')
        .bit3('__skip1__')
        .bit1('blankingDistanceScalingInCm')
        .bit1('__skip2__')
    }
  )
  .uint32le('serialNumber')
  .uint32le('numberOfSamples')
  .uint32le('startSampleIndex')
  .floatle('samplingRate')
  .seek(function() { return this['offsetOfData'] - 28 })
  .array(
    'echosounderRawData',
    {
      type: new Parser().int32le(),
      length: function() { return 2 * this['numberOfSamples'] }
    }
  )
;

const df3VelocityData = new Parser()
  .nest({ type: df3CurrentProfileData })
  .saveOffset('__current__')
  .seek(function() { return this['dataStart'] - this['__current__'] })
  .seek(30)
  .wrapped({
    length: 2,
    wrapper: buffer => buffer.reverse(),
    type: new Parser()
      .bit4('numberOfBeams')
      .bit2(
        'coordinateSystem',
        {
          formatter: (value) => {
            switch (value) {
              case 0: return 'ENU';
              case 1: return 'XYZ';
              case 2: return 'BEAM';
              case 3: return 'not used';
            }
          }
        }
      )
      .bit10('numberOfCells')
  })
  .saveOffset('__current__')
  .seek(function() { return this['dataStart'] + this['offsetOfData'] - this['__current__'] })
  .choice(
    '__skip__',
    {
      // Undocumented. This seems to work for the listed record types...
      tag: 'dataSeriesId',
      choices: {
        0x16: new Parser(),
        0x18: new Parser(),
        0x15: new Parser().floatle('stmDataScattering').floatle('stmDataHighRange'),
        0x1a: new Parser().floatle('stmDataScattering').floatle('stmDataHighRange'),
      },
    }
  )
  .array(
    'velocityData',
    {
      type: new Parser().int16le('v', { formatter: function(value) { return 10 ** this.$parent['VelocityScaling'] * value } }),
      length: function() {
        return this['numberOfBeams'] * this['numberOfCells']
          * this['hasVelocityData']
          * this['hasCorrelationData'];
      }
    }
  )
  .array(
    'amplitudeData',
    {
      type: new Parser().uint8('v', { formatter: function(value) { return 0.5 * value } }),
      length: function() {
        return this['numberOfBeams'] * this['numberOfCells']
          * this['hasAmplitudeData']
          * this['hasCorrelationData'];
      }
    }
  )
  .array(
    'correlationData',
    {
      type: new Parser().uint8(),
      length: function() {
        return this['numberOfBeams'] * this['numberOfCells']
          * this['hasCorrelationData'];
      }
    }
  )
  .choice(
    'altimeterData',
    {
      tag: function () { return this['hasAltimeterData'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('altimeter')
          .uint16le('altimeterQuality')
          .uint16le('altimeterStatus')
      },
    }
  )
  .choice(
    'astData',
    {
      tag: function () { return this['hasAstData'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('astDistance')
          .uint16le('astQuality')
          .int16le('astOffset')
          .floatle('astPressure')
      },
    }
  )
  .choice(
    'altimeterRawData',
    {
      tag: function () { return this['hasAltimeterRawData'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .uint32le('numRawSamples')
          .uint16le('samplesDistance', { formatter: function(value) { return 1e-4 * value } })
          .array(
            'dataSamples',
            {
              type: new Parser().int16le(),
              length: function() { return this['numRawSamples'] }
            }
          )
      }
    }
  )
  .choice(
    'ahrsData',
    {
      tag: function () { return this['hasAhrsData'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .array(
            'rotationMatrix',
            {
              type: new Parser().floatle(),
              length: 9,
            }
          )
          .array(
            'quaternion',
            {
              type: new Parser().floatle(),
              length: 4
            }
          )
          .array(
            'gyro',
            {
              type: new Parser().floatle(),
              length: 3
            }
          )
      }
    }
  )
  .array(
    'percentageGoodData',
    {
      type: new Parser().uint8(),
      length: function() { return this['numberOfCells'] * this['hasPercentageGoodData'] }
    }
  )
  .choice(
    'standardDeviationData',
    {
      tag: function () { return this['hasStandardDeviationData'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .int16le('pitch', { formatter: function(value) { return 1e-2 * value } })
          .int16le('roll', { formatter: function(value) { return 1e-2 * value } })
          .int16le('heading', { formatter: function(value) { return 1e-2 * value } })
          .int16le('pressure', { formatter: function(value) { return 1e-3 * value } })
      }
    }
  )
;

const df3SpectrumData = new Parser()
  .useContextVars()
  .nest({ type: df3CurrentProfileData })
  .saveOffset('__current__')
  .seek(function() { return this['dataStart'] - this['__current__'] })
  .seek(30)
  .wrapped({
    length: 2,
    wrapper: buffer => buffer.reverse(),
    type: new Parser()
      .bit3('numberOfBeams')
      .bit13('numberOfBins')
  })
  .saveOffset('__current__')
  .seek(function() { return this['dataStart'] + this['offsetOfData'] - this['__current__'] })
  .seek(56)
  .choice(
    'SpectrumData', 
    {
      tag: function () { return this['hasSpectrumData'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('startFrequency')
          .floatle('stepFrequency')
          .array('bins', {
            type: new Parser().int16le(),
            length: function() { return this.$parent['numberOfBeams'] * this.$parent['numberOfBins'] }
          })
      }
    }
  )
;

const waveData = new Parser()
  .uint8('version')
  .uint8('offsetOfData')
  .wrapped({
      length: 2, 
      wrapper: buffer => buffer.reverse(),
      type: new Parser()
        .bit11('__skip__')
        .bit1('hasWaveDirectionSpectra')
        .bit1('hasFourierSpectra')
        .bit1('hasWaveBand')
        .bit1('hasEnergySpectra')
        .bit1('hasWaveParameters')
  })
  .uint32le('serialNumber')
  .nest('dateTime', dateTime)
  .uint16le('waveCounter')
  .nest(
    'error',
    {
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
        .bit19('__skip__')
    }
  )
  .nest(
    'utatus',
    {
      type: new Parser()
        .bit16('__skip1__')
        .bit1('activeConfiguration')
        .bit15('__skip2__')
    }
  )
  .uint8(
    'spectrumType',
    {
      formatter: function(value) {
        switch (value) {
          case 0: return 'Pressure';
          case 1: return 'Velocity';
          case 2: return 'Auto depth';
          case 3: return 'AST only';
          default: return 'unknown';
        }
      }
    }
  )
  .uint8(
    'processingMethod',
    {
      formatter: function(value) {
        switch (value) {
          case 2: return 'SUV';
          case 4: return 'MLMST';
          default: return 'unknown';
        }
      }
    }
  )
  .uint8('targetCell')
  .uint8('__skip2__')
  .uint16le('numberOfNoDetects')
  .uint16le('numberOfBadDetects')
  .floatle('cutOffFrequency')
  .floatle('processingTime')
  .uint16le('numberOfZeroCrossings')
  .string('versionString', { length: 4 })
  .array('__skip3__', { type: new Parser().uint8(), length: 54 })
  .saveOffset('__current__')
  .seek(function() { return this['dataStart'] + this['offsetOfData'] - this['__current__'] })
  .choice(
    'waveData',
    {
      tag: function () { return this['hasWaveParameters'] },
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
          .array('__skip__', { type: new Parser().uint8(), length: 20 })
      }
    }
  )
  .choice(
    'swellWaves', 
    {
      tag: function () { return this['hasWaveBand'] },
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
          .array('__skip__', { type: new Parser().uint8(), length: 20 })
      }
    }
  )
  .choice(
    'seaWaves', 
    {
      tag: function () { return this['hasWaveBand'] },
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
          .array('__skip__', { type: new Parser().uint8(), length: 20 })
      }
    }
  )
  .choice(
    'energySpectrum', 
    {
      tag: function () { return this['hasEnergySpectra'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('lowFrequency')
          .floatle('highFrequency')
          .floatle('stepFrequency')
          .uint16le('nBins')
          .array('__skip__', { type: new Parser().uint8(), length: 22 })
          .array(
            'data',
            {
              type: new Parser().floatle(),
              length: 'nBins'
            }
          )
      }
    }
  )
  .choice(
    'fourierCoefficients', 
    {
      tag: function () { return this['hasFourierSpectra'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('lowFrequency')
          .floatle('highFrequency')
          .floatle('stepFrequency')
          .uint16le('nBins')
          .array('__skip__', { type: new Parser().uint8(), length: 22 })
          .array(
            'data',
            {
              type: new Parser().floatle(),
              length: function() { return 4*this['nBins'] }
            }
          )
      }
    }
  )
  .choice(
    'direction', 
    {
      tag: function () { return this['hasWaveDirectionSpectra'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('lowFrequency')
          .floatle('highFrequency')
          .floatle('stepFrequency')
          .uint16le('nBins')
          .array('__skip__', { type: new Parser().uint8(), length: 22 })
          .array(
            'data',
            {
              type: new Parser().floatle(),
              length: function() { return 2*this['nBins'] }
            }
          )
      }
    }
  )
;

export function parse(data) {
  const ad2cp = new Parser()
    .useContextVars()
    .array(
      'data',
      {
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
              0xa0: new Parser().string('data', { length: 'dataSize'})
            },
            defaultChoice: new Parser(),
          })
          .saveOffset('__current__')
          .seek(function() { 
            const n = this['dataStart'] + this['dataSize'] - this['__current__'];
            if (n != 0) {
              console.warn(`Did not consume whole record: skipping ${n} bytes`, this)
            }
            return n
          })
          ,
        readUntil: 'eof'
      }
    )
    ;
  return ad2cp.parse(data).data;
}
