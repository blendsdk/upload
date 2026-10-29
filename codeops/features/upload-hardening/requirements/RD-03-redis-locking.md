# RD-03: Redis tus Locking

> **Status**: Implemented
> **Depends On**: —

## Requirements

- A `RedisLocker` implements the tus `Locker`/`Lock` contract.
- Locks use `SET NX PX`, compare-and-delete release and a configurable acquire timeout.
- It accepts a minimal Redis client interface, so consumers can pass ioredis or another client.
- Lock conflicts call the tus `requestRelease` callback and retry until acquired or timed out.
- A fake client test covers acquire, conflict, release and timeout.

## Acceptance

- [ ] `RedisLocker` is exported.
- [ ] Unit tests pass without a live Redis server.
- [ ] Documentation shows ioredis wiring.
