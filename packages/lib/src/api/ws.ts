import { Context } from 'cordis'
import { WsEvents } from '.'
import { v4 } from 'uuid'

const URL = 'ws://127.0.0.1:8080'

declare module 'cordis' {
    interface Events<C extends Context = Context> {
        'console/message'(data: WsEvent): void
    }
}

export interface WsEvent<T extends WsEvents.Events = WsEvents.Events> {
    id?: string
    type: T
    data: WsEvents[T]
}

export class WsApi {
    socket: WebSocket
    responseHook: Record<string, [Function, Function]>

    constructor(private ctx: Context) {}

    start() {
        if (this.socket) return
        this.socket = new WebSocket(URL)
        this.socket.onmessage = message => {
            const data = JSON.parse(message.data)
            if (!data.type) return
            if (data.type === 'internal/message-reply') {
                const [resolve] = this.responseHook[data.id]
                resolve(data.data)
                return
            }
            this.ctx.emit('console/message', data)
        }
    }

    send<T extends WsEvents.Events, U extends WsEvents.Events>(message: WsEvent<T>): Promise<WsEvent<U>> {
        const id = v4()
        message.id = id
        this.socket.send(JSON.stringify(message))
        return new Promise((resolve, reject) => {
            this.responseHook[id] = [resolve, reject]
            setTimeout(() => {
                delete this.responseHook[id]
                reject(new Error('timeout'))
            }, 60000)
        })
    }
}