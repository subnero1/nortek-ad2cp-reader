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
    .bit1('DataRetrievalFifoError')
    .bit1('DataRetrievalOverflow')
    .bit1('DataRetrievalUnderrun')
    .bit1('DataRetrievalSamplesMissing')
    .bit1('MeasurementNotFinished')
    .bit1('SensorReadFailure')
    .bit2('__skip__')
    .bit1('TagErrorBeam1InPhase')
    .bit1('TagErrorBeam1QuadraturePhase')
    .bit1('TagErrorBeam2InPhase')
    .bit1('TagErrorBeam2QuadraturePhase')
    .bit1('TagErrorBeam3InPhase')
    .bit1('TagErrorBeam3QuadraturePhase')
    .bit1('TagErrorBeam4InPhase')
    .bit1('TagErrorBeam4QuadraturePhase')
};

const header = new Parser()
  .uint8('SyncByte', { assert: 0xa5 })
  .uint8('HeaderSize')
  .uint8('DataSeriesId')
  .uint8(
    'FamilyId',
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
    'DataSize',
    {
      tag: 'HeaderSize',
      choices: {
        10: new Parser().uint16le(),
        12: new Parser().uint32le()
      }
    },
  )
  .uint16le('DataChecksum')
  .uint16le('HeaderChecksum')
;

const commonData = new Parser()
  .uint8('Version')
  .uint8('OffsetOfData')
  .seek(2)
  .uint32le('SerialNumber')
  .nest('DateTime', dateTime)
  .uint16le('SpeedOfSound', { formatter: function(value) { return 0.1 * value } })
  .int16le('Temperature', { formatter: function(value) { return 0.01 * value } })
  .uint32le('Pressure')
  .uint16le('Heading', { formatter: function(value) { return 0.01 * value } })
  .int16le('Pitch', { formatter: function(value) { return 0.01 * value } })
  .int16le('Roll', { formatter: function(value) { return 0.01 * value } })
  .seek(2)
  .uint16le('CellSize', { formatter: function(value) { return 0.001 * value } })
  .seek(2)
  .uint8('NominalCorrelation')
  .seek(1)
  .uint16le('BatteryVoltage', { formatter: function(value) { return 0.1 * value } })
  .array(
    'Magnetometer',
    {
      type: new Parser().int16le(),
      length: 3
    }
  )
  .array(
    'Accelerometer',
    {
      type: new Parser().int16le('v', { formatter: function(value) { return 9.819/16384 * value } }),
      length: 3
    }
  )
  .seek(2)
  .uint16le('DataSetDescription')
  .uint16le('TransmittedEnergy')
  .int8('VelocityScaling')
  .int8('PowerLevel')
  .int16le('MagnetometerTemperature', { formatter: function(value) { return 0.001 * value } })
  .int16le('RealTimeClockTemperature')
  .nest('ErrorStatus', errorStatus)
  .uint32le('EnsembleCounter')
;

const df3CurrentProfileData = new Parser()
  .nest({ type: commonData })
  .saveOffset('__current__')
  .seek(function() { return this['DataStart'] - this['__current__'] })
  .seek(2)
  .wrapped({
      length: 2,
      wrapper: buffer => buffer.reverse(),
      type: new Parser()
        .bit1('HasSpectrumData')
        .bit1('HasStandardDeviationData')
        .bit1('HasPercentageGoodData')
        .bit1('HasAhrsData')
        .bit1('HasEchosounderData')
        .bit1('HasAstData')
        .bit1('HasAltimeterRawData')
        .bit1('HasAltimeterData')
        .bit1('HasCorrelationData')
        .bit1('HasAmplitudeData')
        .bit1('HasVelocityData')
        .bit1('HasExternalSensor')
        .bit1('HasTiltSensor')
        .bit1('HasCompassSensor')
        .bit1('HasTemperatureSensor')
        .bit1('HasPressureSensor')
    }
  )
  .seek(33)
  .uint8('TemperaturePressureSensor', { formatter: function(value) { return value/5 - 4 } })
  .seek(14)
  .uint16le('AmbiguityVelocity', { formatter: function(value) { return 10 ** this['VelocityScaling'] * value } })
  .seek(12)
  .nest(
    'ExtendedStatus',
    { 
      type: new Parser()
        .bit1('ProcessorIdlesLessThan3Percent')
        .bit1('ProcessorIdlesLessThan6Percent')
        .bit1('ProcessorIdlesLessThan12Percent')
        .bit1('ExternalSoundVelocityProbe')
        .bit1('ExternalHeadingPitchRollPosition')
        .bit1('ExternalHeading')
        .bit1('ExternalPitchRoll')
        .bit1('FileSystemFlush')
        .bit1('InternalProcessing')
        .bit1('ExtendedStatusShouldBeInterpreted')
    }
  )
  .wrapped(
    'Status', 
    {
      length: 4, 
      wrapper: buffer => buffer.reverse(),
      type: new Parser()
        .bit4(
          'WakeUpState',
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
          'Orientation',
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
          'AutoOrientation',
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
          'PreviousWakeupState',
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
        .bit1('PreviousMeasurementSkippedDueToLowVoltage')
        .bit1('ActiveConfiguration')
        .bit4('EchosounderIndex', { formatter: function(value) { return value + 1 } })
        .bit1('TelemetryData')
        .bit1('BoostRunning')
        .bit5('EchosounderFrequencyBin')
        .bit3('__skip1__')
        .bit1('BlankingDistanceScalingInCm')
        .bit1('__skip2__')
    }
  )
  .seek(-36)
  .uint16le(
    'Blanking',
    { formatter: function(value) { return value * (this['BlankingDistanceScalingInCm'] ? 0.01 : 0.001) } }
  )
;

const df3EchosounderData = new Parser()
  .nest({ type: df3CurrentProfileData })
  .saveOffset('__current__')
  .seek(function() { return this['DataStart'] - this['__current__'] })
  .seek(30)
  .uint16le('NumberOfCells')
  .seek(20)
  .uint16le('EchosounderFrequency')
  .seek(function() { return this['OffsetOfData'] - 54 })
  .array(
    'EchosounderData',
    {
      type: new Parser().uint16le('v', { formatter: function(value) { return 0.01 * value } }),
      length: function() { return this['NumberOfCells'] }
    }
  )
;

const echosounderRawData = new Parser()
  .uint8('Version')
  .uint8('OffsetOfData')
  .nest('DateTime', dateTime)
  .nest('ErrorStatus', errorStatus)
  .wrapped(
    'Status', 
    {
      length: 4, 
      wrapper: buffer => buffer.reverse(),
      type: new Parser()
        .bit4(
          'WakeUpState',
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
          'Orientation',
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
          'AutoOrientation',
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
          'PreviousWakeupState',
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
        .bit1('LastMeasurementLowVoltageSkip')
        .bit1('ActiveConfiguration')
        .bit4('EchoIndex', { formatter: function(value) { return `FREQ${value+1}` } })
        .bit1('TelemetryData')
        .bit1('BoostRunning')
        .bit5('EchoFrequencyBin')
        .bit3('__skip1__')
        .bit1('BlankingDistanceScalingInCm')
        .bit1('__skip2__')
    }
  )
  .uint32le('SerialNumber')
  .uint32le('NumberOfSamples')
  .uint32le('StartSampleIndex')
  .floatle('SamplingRate')
  .seek(function() { return this['OffsetOfData'] - 28 })
  .array(
    'EchosounderRawData',
    {
      type: new Parser().int32le(),
      length: function() { return 2 * this['NumberOfSamples'] }
    }
  )
;

const df3VelocityData = new Parser()
  .nest({ type: df3CurrentProfileData })
  .saveOffset('__current__')
  .seek(function() { return this['DataStart'] - this['__current__'] })
  .seek(30)
  .wrapped({
    length: 2,
    wrapper: buffer => buffer.reverse(),
    type: new Parser()
      .bit4('NumberOfBeams')
      .bit2(
        'CoordinateSystem', 
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
      .bit10('NumberOfCells')
  })
  .saveOffset('__current__')
  .seek(function() { return this['DataStart'] + this['OffsetOfData'] - this['__current__'] })
  .choice(
    '__skip__',
    {
      // Undocumented. This seems to work for the listed ...
      tag: 'DataSeriesId',
      choices: {
        0x16: new Parser(),
        0x18: new Parser(),
        0x15: new Parser().floatle('StmDataScattering').floatle('StmDataHighRange'),
        0x1a: new Parser().floatle('StmDataScattering').floatle('StmDataHighRange'),
      },
    }
  )
  .array(
    'VelocityData',
    {
      type: new Parser().int16le('v', { formatter: function(value) { return 10 ** this.$parent['VelocityScaling'] * value } }),
      length: function() {
        return this['NumberOfBeams'] * this['NumberOfCells']
          * this['HasVelocityData']
          * this['HasCorrelationData'];
      }
    }
  )
  .array(
    'AmplitudeData',
    {
      type: new Parser().uint8('v', { formatter: function(value) { return 0.5 * value } }),
      length: function() {
        return this['NumberOfBeams'] * this['NumberOfCells']
          * this['HasAmplitudeData']
          * this['HasCorrelationData'];
      }
    }
  )
  .array(
    'CorrelationData',
    {
      type: new Parser().uint8(),
      length: function() {
        return this['NumberOfBeams'] * this['NumberOfCells']
          * this['HasCorrelationData'];
      }
    }
  )
  .choice(
    'AltimeterData',
    {
      tag: function () { return this['HasAltimeterData'] }, 
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('Altimeter')
          .uint16le('AltimeterQuality')
          .uint16le('AltimeterStatus')
      },
    }
  )
  .choice(
    'AstData',
    {
      tag: function () { return this['HasAstData'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('AstDistance')
          .uint16le('AstQuality')
          .int16le('AstOffset')
          .floatle('AstPressure')
      },
    }
  )
  .choice(
    'AltimeterRawData',
    {
      tag: function () { return this['HasAltimeterRawData'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .uint32le('NumRawSamples')
          .uint16le('SamplesDistance', { formatter: function(value) { return 1e-4 * value } })
          .array(
            'DataSamples',
            {
              type: new Parser().int16le(),
              length: function() { return this['NumRawSamples'] }
            }
          )
      }
    }
  )
  .choice(
    'AhrsData', 
    {
      tag: function () { return this['HasAhrsData'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .array(
            'RotationMatrix',
            {
              type: new Parser().floatle(),
              length: 9,
            }
          )
          .array(
            'Quaternion',
            {
              type: new Parser().floatle(),
              length: 4
            }
          )
          .array(
            'Gyro',
            {
              type: new Parser().floatle(),
              length: 3
            }
          )
      }
    }
  )
  .array(
    'PercentageGoodData',
    {
      type: new Parser().uint8(),
      length: function() { return this['NumberOfCells'] * this['HasPercentageGoodData'] }
    }
  )
  .choice(
    'StandardDeviationData', 
    {
      tag: function () { return this['HasStandardDeviationData'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .int16le('Pitch', { formatter: function(value) { return 1e-2 * value } })
          .int16le('Roll', { formatter: function(value) { return 1e-2 * value } })
          .int16le('Heading', { formatter: function(value) { return 1e-2 * value } })
          .int16le('Pressure', { formatter: function(value) { return 1e-3 * value } })
      }
    }
  )
;

const df3SpectrumData = new Parser()
  .useContextVars()
  .nest({ type: df3CurrentProfileData })
  .saveOffset('__current__')
  .seek(function() { return this['DataStart'] - this['__current__'] })
  .seek(30)
  .wrapped({
    length: 2,
    wrapper: buffer => buffer.reverse(),
    type: new Parser()
      .bit3('NumberOfBeams')
      .bit13('NumberOfBins')
  })
  .saveOffset('__current__')
  .seek(function() { return this['DataStart'] + this['OffsetOfData'] - this['__current__'] })
  .seek(56)
  .choice(
    'SpectrumData', 
    {
      tag: function () { return this['HasSpectrumData'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('StartFrequency')
          .floatle('StepFrequency')
          .array('Bins', {
            type: new Parser().int16le(),
            length: function() { return this.$parent['NumberOfBeams'] * this.$parent['NumberOfBins'] }
          })
      }
    }
  )
;

const waveData = new Parser()
  .uint8('Version')
  .uint8('OffsetOfData')
  .wrapped({
      length: 2, 
      wrapper: buffer => buffer.reverse(),
      type: new Parser()
        .bit11('__skip__')
        .bit1('HasWaveDirectionSpectra')
        .bit1('HasFourierSpectra')
        .bit1('HasWaveBand')
        .bit1('HasEnergySpectra')
        .bit1('HasWaveParameters')
  })
  .uint32le('SerialNumber')
  .nest('DateTime', dateTime)
  .uint16le('WaveCounter')
  .nest(
    'Error',
    {
      type: new Parser()
        .bit1('NoPressure')
        .bit1('LowPressure')
        .bit1('LowAmp')
        .bit1('WhiteNoise')
        .bit1('UnreasonableEstimation')
        .bit1('NeverProcessed')
        .bit1('AstOutOfBound')
        .bit1('DirectionAmbiguity')
        .bit1('NoPressurePeak')
        .bit1('CloseToClip')
        .bit1('AstHeightLoss')
        .bit1('HighTilt')
        .bit1('Correlation')
        .bit19('__skip__')
    }
  )
  .nest(
    'Status',
    {
      type: new Parser()
        .bit16('__skip1__')
        .bit1('ActiveConfiguration')
        .bit15('__skip2__')
    }
  )
  .uint8(
    'SpectrumType',
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
    'ProcessingMethod',
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
  .uint8('TargetCell')
  .uint8('__skip2__')
  .uint16le('NumberOfNoDetects')
  .uint16le('NumberOfBadDetects')
  .floatle('CutOffFrequency')
  .floatle('ProcessingTime')
  .uint16le('NumberOfZeroCrossings')
  .string('VersionString', { length: 4 })
  .array('__skip3__', { type: new Parser().uint8(), length: 54 })
  .saveOffset('__current__')
  .seek(function() { return this['DataStart'] + this['OffsetOfData'] - this['__current__'] })
  .choice(
    'WaveData',
    {
      tag: function () { return this['HasWaveParameters'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('Height0')
          .floatle('Height3')
          .floatle('Height10')
          .floatle('HeightMax')
          .floatle('HeightMean')
          .floatle('PeriodMean')
          .floatle('PeriodPeak')
          .floatle('PeriodZ')
          .floatle('Period1d3')
          .floatle('Period1d10')
          .floatle('PeriodMax')
          .floatle('PeriodEnergy')
          .floatle('DirectionAtPeakPeriod')
          .floatle('SpreadingAtPeakPeriod')
          .floatle('WaveDirectionMean')
          .floatle('UnidirectivityIndex')
          .floatle('PressureMean')
          .floatle('CurrentSpeedMean')
          .floatle('CurrentDirectionMean')
          .floatle('AstMeanDistance')
          .array('__skip__', { type: new Parser().uint8(), length: 20 })
      }
    }
  )
  .choice(
    'SwellWaves', 
    {
      tag: function () { return this['HasWaveBand'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('LowFrequency')
          .floatle('HighFrequency')
          .floatle('Height0')
          .floatle('PeriodMean')
          .floatle('PeriodPeak')
          .floatle('DirectionAtPeakPeriod')
          .floatle('WaveDirectionMean')
          .floatle('SpreadingAtPeakPeriod')
          .array('__skip__', { type: new Parser().uint8(), length: 20 })
      }
    }
  )
  .choice(
    'SeaWaves', 
    {
      tag: function () { return this['HasWaveBand'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('LowFrequency')
          .floatle('HighFrequency')
          .floatle('Height0')
          .floatle('PeriodMean')
          .floatle('PeriodPeak')
          .floatle('DirectionAtPeakPeriod')
          .floatle('WaveDirectionMean')
          .floatle('SpreadingAtPeakPeriod')
          .array('__skip__', { type: new Parser().uint8(), length: 20 })
      }
    }
  )
  .choice(
    'EnergySpectrum', 
    {
      tag: function () { return this['HasEnergySpectra'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('LowFrequency')
          .floatle('HighFrequency')
          .floatle('StepFrequency')
          .uint16le('NBins')
          .array('__skip__', { type: new Parser().uint8(), length: 22 })
          .array(
            'Data',
            {
              type: new Parser().floatle(),
              length: 'NBins'
            }
          )
      }
    }
  )
  .choice(
    'FourierCoefficients', 
    {
      tag: function () { return this['HasFourierSpectra'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('LowFrequency')
          .floatle('HighFrequency')
          .floatle('StepFrequency')
          .uint16le('NBins')
          .array('__skip__', { type: new Parser().uint8(), length: 22 })
          .array(
            'Data',
            {
              type: new Parser().floatle(),
              length: function() { return 4*this['NBins'] }
            }
          )
      }
    }
  )
  .choice(
    'Direction', 
    {
      tag: function () { return this['HasWaveDirectionSpectra'] },
      choices: {
        0: new Parser(),
        1: new Parser()
          .floatle('LowFrequency')
          .floatle('HighFrequency')
          .floatle('StepFrequency')
          .uint16le('NBins')
          .array('__skip__', { type: new Parser().uint8(), length: 22 })
          .array(
            'Data',
            {
              type: new Parser().floatle(),
              length: function() { return 2*this['NBins'] }
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
          .saveOffset('DataStart')
          .choice({
            tag: 'DataSeriesId',
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
              0xa0: new Parser().string('data', { length: 'DataSize'})
            },
            defaultChoice: new Parser(),
          })
          .saveOffset('__current__')
          .seek(function() { 
            const n = this['DataStart'] + this['DataSize'] - this['__current__'];
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
