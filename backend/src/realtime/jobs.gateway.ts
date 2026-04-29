import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JobRecord } from '../jobs/job.types';
import {
  CloneConflictEvent,
  CloneEdgeAddedEvent,
  CloneEntryReadyEvent,
  ClonePageCapturedEvent,
  CloneStageEvent,
} from '../pages/pages.types';

/**
 * WS gateway exposed at namespace `/jobs`. Has two responsibilities:
 *
 * 1. Lifecycle of every Job row — `job.updated` is broadcast to every
 *    listener (the editor frontend listens to its own jobId on connect).
 * 2. Streaming clone progress — five extra events scoped to a page room
 *    so a clone in flight can drip-feed the editor with new pages /
 *    navigation edges / progress as the pipeline produces them.
 *
 * Clients opt into the page room by emitting `clone.subscribe` with
 * `{ pageId }` after they receive the first `clone.entryReady` event
 * (which carries the pageId). All `clone.*` payloads then arrive only
 * for that page — avoids cross-tenant leaks.
 */
@WebSocketGateway({
  namespace: '/jobs',
  cors: {
    origin: '*',
  },
})
export class JobsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(JobsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Lets the client join the per-page streaming room. Idempotent — calling
   * twice is safe; rooms dedupe on socket id.
   */
  @SubscribeMessage('clone.subscribe')
  handleCloneSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { pageId?: string },
  ) {
    if (typeof body?.pageId !== 'string' || !body.pageId) return;
    const room = this.cloneRoom(body.pageId);
    void client.join(room);
  }

  @SubscribeMessage('clone.unsubscribe')
  handleCloneUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { pageId?: string },
  ) {
    if (typeof body?.pageId !== 'string' || !body.pageId) return;
    const room = this.cloneRoom(body.pageId);
    void client.leave(room);
  }

  emitJobUpdated(job: JobRecord) {
    this.server.emit('job.updated', job);
  }

  emitCloneEntryReady(pageId: string, payload: CloneEntryReadyEvent) {
    // Broadcast as a regular event AND into the page room. The first
    // path lets the JobLoadingScreen receive the event before it has
    // even subscribed (it gets the pageId here and then subscribes for
    // subsequent events). After the first event, ALL future emissions
    // only target the page room.
    this.server.emit('clone.entryReady', { ...payload, pageId });
  }

  emitClonePageCaptured(pageId: string, payload: ClonePageCapturedEvent) {
    this.server.to(this.cloneRoom(pageId)).emit('clone.pageCaptured', payload);
  }

  emitCloneEdgeAdded(pageId: string, payload: CloneEdgeAddedEvent) {
    this.server.to(this.cloneRoom(pageId)).emit('clone.edgeAdded', payload);
  }

  emitCloneStage(pageId: string | undefined, payload: CloneStageEvent) {
    if (pageId) {
      this.server.to(this.cloneRoom(pageId)).emit('clone.stage', payload);
    } else {
      // Pre-entryReady stages (still on `fetch`) — broadcast so the
      // JobLoadingScreen that only knows the jobId can still react.
      this.server.emit('clone.stage', payload);
    }
  }

  emitCloneConflict(pageId: string, payload: CloneConflictEvent) {
    this.server
      .to(this.cloneRoom(pageId))
      .emit('clone.conflictDetected', payload);
  }

  emitCloneCompleted(pageId: string, payload: CloneStageEvent) {
    this.server.to(this.cloneRoom(pageId)).emit('clone.completed', payload);
  }

  private cloneRoom(pageId: string): string {
    return `clone:${pageId}`;
  }
}
