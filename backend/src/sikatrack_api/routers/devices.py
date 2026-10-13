"""/v1/devices: the phones signed in to an account, and where push notifications go."""

import uuid

from fastapi import APIRouter, Response, status

from sikatrack_api import clock, ids
from sikatrack_api.auth.dependencies import CurrentUserDep, SessionDep, SettingsDep
from sikatrack_api.models import Device
from sikatrack_api.schemas.devices import DeviceOut, DevicePut
from sikatrack_api.services.sign_in import check_app_version

router = APIRouter(prefix="/v1/devices", tags=["devices"])


def _out(device: Device) -> DeviceOut:
    return DeviceOut(
        device_id=device.id,
        platform=device.platform,
        app_version=device.app_version,
        push_enabled=device.push_token is not None,
        last_seen_at=device.last_seen_at,
    )


@router.put("/{device_id}", summary="Register or update this phone's push token")
async def put_device(
    device_id: uuid.UUID, body: DevicePut, me: CurrentUserDep, session: SessionDep, settings: SettingsDep
) -> DeviceOut:
    check_app_version(settings, body.app_version)
    device = await session.get(Device, device_id)
    if device is None:
        device = Device(id=device_id, user_id=me.id)
        session.add(device)
    elif device.user_id != me.id:
        raise ids.not_found()  # another account's phone: indistinguishable from unknown
    device.platform, device.app_version, device.push_token = body.platform, body.app_version, body.push_token
    device.last_seen_at = clock.utcnow()
    await session.commit()
    return _out(device)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Stop push to this phone")
async def delete_device(device_id: uuid.UUID, me: CurrentUserDep, session: SessionDep) -> Response:
    device = await session.get(Device, device_id)
    if device is None or device.user_id != me.id:
        raise ids.not_found()
    device.push_token = None
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
