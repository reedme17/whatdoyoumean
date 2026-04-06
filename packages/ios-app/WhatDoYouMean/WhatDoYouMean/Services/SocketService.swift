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

    /// Connect to backend.
    func connect(url: String = "https://whatdoyoumean.onrender.com",
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

        socket.on(clientEvent: .error) { data, _ in
            // data is [Any]; first element is often a SocketAckEmitter (not useful)
            // Only log if it contains a meaningful string or dict
            for item in data {
                if let dict = item as? [String: Any] {
                    print("[WS] Error:", dict["message"] ?? dict)
                    return
                } else if let str = item as? String {
                    print("[WS] Error:", str)
                    return
                }
            }
            // Suppress SocketAckEmitter noise
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
            "session:summary",
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
    /// Socket.IO Swift requires SocketData-conforming items.
    /// We serialize the dict to JSON data then back to a Foundation object
    /// so nested dictionaries are properly handled.
    func send(type: String, data: [String: Any] = [:]) {
        var payload = data
        payload["type"] = type
        if type != "audio:chunk" {
            print("[WS] send: \(type), connected=\(connected)")
        }
        if let jsonData = try? JSONSerialization.data(withJSONObject: payload),
           let jsonObj = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
            socket?.emit(type, jsonObj)
        } else {
            print("[WS] send: JSON round-trip failed for \(type), using raw payload")
            socket?.emit(type, payload)
        }
    }
}
