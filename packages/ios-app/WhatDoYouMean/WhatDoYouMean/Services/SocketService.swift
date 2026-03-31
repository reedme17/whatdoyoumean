import Foundation
import SocketIO

/// WebSocket service — mirrors useSocket.ts.
/// Connects to the Node.js backend via Socket.IO.
@Observable
class SocketService {
    private var manager: SocketManager?
    private var socket: SocketIOClient?
    var connected = false

    private var eventHandler: ((String, [String: Any]) -> Void)?

    /// Connect to backend. In dev, use your Mac's local IP instead of localhost.
    func connect(url: String = "http://192.168.1.105:3001",
                 onEvent: @escaping (String, [String: Any]) -> Void) {
        eventHandler = onEvent

        let manager = SocketManager(
            socketURL: URL(string: url)!,
            config: [.log(false), .compress, .forcePolling(false)]
        )
        self.manager = manager
        let socket = manager.defaultSocket
        self.socket = socket

        socket.on(clientEvent: .connect) { [weak self] _, _ in
            print("[WS] Connected")
            self?.connected = true
        }

        socket.on(clientEvent: .disconnect) { [weak self] _, _ in
            print("[WS] Disconnected")
            self?.connected = false
        }

        socket.on(clientEvent: .error) { _, data in
            print("[WS] Error:", data)
        }

        // Listen for all server event types (matches useSocket.ts eventTypes)
        let eventTypes = [
            "transcript:interim",
            "transcript:final",
            "card:created",
            "card:updated",
            "cards:consolidated",
            "recommendation:new",
            "topic:updated",
            "stt:provider_switch",
            "pending:preview",
            "error",
            "session:state",
            "processing:progress",
        ]

        for type in eventTypes {
            socket.on(type) { [weak self] data, _ in
                let payload = (data.first as? [String: Any]) ?? [:]
                self?.eventHandler?(type, payload)
            }
        }

        socket.connect()
    }

    func disconnect() {
        socket?.disconnect()
        manager?.disconnect()
        connected = false
    }

    /// Send event to server — mirrors useSocket send().
    func send(type: String, data: [String: Any] = [:]) {
        var payload = data
        payload["type"] = type
        socket?.emit(type, payload)
    }
}
