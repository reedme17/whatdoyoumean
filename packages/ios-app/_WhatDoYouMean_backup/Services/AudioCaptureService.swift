import AVFoundation
import Accelerate

/// Audio capture service — mirrors useAudioCapture.ts.
/// Uses AVAudioEngine instead of Web Audio API.
@Observable
class AudioCaptureService {
    private let engine = AVAudioEngine()
    private(set) var isCapturing = false
    private(set) var audioLevel: Float = 0  // RMS level for waveform visualization

    /// Called with base64-encoded WAV chunks, same format as the Electron app sends.
    var onAudioChunk: ((String) -> Void)?

    private let targetSampleRate: Double = 16000
    private let chunkDurationMs: Double = 500  // send every 500ms

    func startCapture() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .default, options: [])
        try session.setActive(true)

        let inputNode = engine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)
        let bufferSize = AVAudioFrameCount(inputFormat.sampleRate * chunkDurationMs / 1000)

        inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) {
            [weak self] buffer, _ in
            guard let self else { return }
            self.processBuffer(buffer, inputRate: inputFormat.sampleRate)
        }

        try engine.start()
        isCapturing = true
    }

    func stopCapture() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        isCapturing = false
        audioLevel = 0
        try? AVAudioSession.sharedInstance().setActive(false)
    }

    func pauseCapture() {
        engine.pause()
        isCapturing = false
    }

    func resumeCapture() throws {
        try engine.start()
        isCapturing = true
    }

    // MARK: - Audio Processing (mirrors encodeWavBase64 + downsample in useAudioCapture.ts)

    private func processBuffer(_ buffer: AVAudioPCMBuffer, inputRate: Double) {
        guard let channelData = buffer.floatChannelData?[0] else { return }
        let frameCount = Int(buffer.frameLength)
        let samples = Array(UnsafeBufferPointer(start: channelData, count: frameCount))

        // Calculate RMS for visualization (mirrors calculateRMS)
        let rms = calculateRMS(samples)
        DispatchQueue.main.async { self.audioLevel = rms }

        // Downsample if needed (mirrors downsample function)
        let resampled: [Float]
        if inputRate != targetSampleRate {
            resampled = downsample(samples, from: inputRate, to: targetSampleRate)
        } else {
            resampled = samples
        }

        // Encode as WAV base64 (mirrors encodeWavBase64)
        let wavData = encodeWav(samples: resampled, sampleRate: Int(targetSampleRate))
        let base64 = wavData.base64EncodedString()
        onAudioChunk?(base64)
    }

    private func calculateRMS(_ samples: [Float]) -> Float {
        guard !samples.isEmpty else { return 0 }
        var sum: Float = 0
        vDSP_measqv(samples, 1, &sum, vDSP_Length(samples.count))
        return sqrt(sum)
    }

    private func downsample(_ buffer: [Float], from fromRate: Double, to toRate: Double) -> [Float] {
        let ratio = fromRate / toRate
        let newLength = Int(Double(buffer.count) / ratio)
        var result = [Float](repeating: 0, count: newLength)
        for i in 0..<newLength {
            let srcIndex = Int(Double(i) * ratio)
            result[i] = buffer[min(srcIndex, buffer.count - 1)]
        }
        return result
    }

    /// Encode Float32 samples as 16-bit PCM WAV — same format as useAudioCapture.ts encodeWavBase64.
    private func encodeWav(samples: [Float], sampleRate: Int) -> Data {
        let numChannels: Int = 1
        let bitsPerSample: Int = 16
        let byteRate = sampleRate * numChannels * bitsPerSample / 8
        let blockAlign = numChannels * bitsPerSample / 8
        let dataSize = samples.count * blockAlign
        let fileSize = 44 + dataSize

        var data = Data(capacity: fileSize)

        // RIFF header
        data.append(contentsOf: "RIFF".utf8)
        data.append(uint32LE: UInt32(fileSize - 8))
        data.append(contentsOf: "WAVE".utf8)

        // fmt chunk
        data.append(contentsOf: "fmt ".utf8)
        data.append(uint32LE: 16)
        data.append(uint16LE: 1)  // PCM
        data.append(uint16LE: UInt16(numChannels))
        data.append(uint32LE: UInt32(sampleRate))
        data.append(uint32LE: UInt32(byteRate))
        data.append(uint16LE: UInt16(blockAlign))
        data.append(uint16LE: UInt16(bitsPerSample))

        // data chunk
        data.append(contentsOf: "data".utf8)
        data.append(uint32LE: UInt32(dataSize))

        // Convert Float32 [-1, 1] to Int16
        for sample in samples {
            let clamped = max(-1.0, min(1.0, sample))
            let int16 = Int16(clamped * 32767)
            data.append(uint16LE: UInt16(bitPattern: int16))
        }

        return data
    }

    // MARK: - Permissions

    static func requestMicrophonePermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }
}

// MARK: - Data helpers for WAV encoding

private extension Data {
    mutating func append(uint32LE value: UInt32) {
        var v = value.littleEndian
        append(Data(bytes: &v, count: 4))
    }

    mutating func append(uint16LE value: UInt16) {
        var v = value.littleEndian
        append(Data(bytes: &v, count: 2))
    }
}
