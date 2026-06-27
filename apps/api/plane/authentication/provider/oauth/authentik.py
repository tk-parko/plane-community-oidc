# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os
from datetime import datetime, timedelta
from urllib.parse import urlencode, urlparse
import pytz
import requests

# Module imports
from plane.authentication.adapter.oauth import OauthAdapter
from plane.license.utils.instance_value import get_configuration_value
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)


class AuthentikOAuthProvider(OauthAdapter):
    provider = "authentik"
    scope = "openid email profile"

    def __init__(self, request, code=None, state=None, callback=None):
        (
            AUTHENTIK_CLIENT_ID,
            AUTHENTIK_CLIENT_SECRET,
            AUTHENTIK_HOST,
            AUTHENTIK_APP_NAME,
        ) = get_configuration_value(
            [
                {
                    "key": "AUTHENTIK_CLIENT_ID",
                    "default": os.environ.get("AUTHENTIK_CLIENT_ID"),
                },
                {
                    "key": "AUTHENTIK_CLIENT_SECRET",
                    "default": os.environ.get("AUTHENTIK_CLIENT_SECRET"),
                },
                {
                    "key": "AUTHENTIK_HOST",
                    "default": os.environ.get("AUTHENTIK_HOST"),
                },
                {
                    "key": "AUTHENTIK_APP_NAME",
                    "default": os.environ.get("AUTHENTIK_APP_NAME"),
                },
            ]
        )

        if not (AUTHENTIK_CLIENT_ID and AUTHENTIK_CLIENT_SECRET and AUTHENTIK_HOST and AUTHENTIK_APP_NAME):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["AUTHENTIK_NOT_CONFIGURED"],
                error_message="AUTHENTIK_NOT_CONFIGURED",
            )

        parsed = urlparse(AUTHENTIK_HOST)
        if not parsed.scheme:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["AUTHENTIK_NOT_CONFIGURED"],
                error_message="AUTHENTIK_NOT_CONFIGURED",
            )
        if parsed.hostname and parsed.hostname not in ("localhost", "127.0.0.1", "0.0.0.0") and parsed.scheme != "https":
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["AUTHENTIK_NOT_CONFIGURED"],
                error_message="AUTHENTIK_NOT_CONFIGURED",
            )
        AUTHENTIK_HOST = AUTHENTIK_HOST.rstrip("/")

        # Resolve OIDC endpoints via discovery, fall back to hardcoded patterns
        discovery_url = f"{AUTHENTIK_HOST}/application/o/{AUTHENTIK_APP_NAME}/.well-known/openid-configuration"
        try:
            resp = requests.get(discovery_url, timeout=10)
            resp.raise_for_status()
            discovery = resp.json()
            self.token_url = discovery.get("token_endpoint") or f"{AUTHENTIK_HOST}/application/o/{AUTHENTIK_APP_NAME}/token/"
            self.userinfo_url = discovery.get("userinfo_endpoint") or f"{AUTHENTIK_HOST}/application/o/{AUTHENTIK_APP_NAME}/userinfo/"
            authorize_endpoint = discovery.get("authorization_endpoint") or f"{AUTHENTIK_HOST}/application/o/{AUTHENTIK_APP_NAME}/authorize/"
        except requests.RequestException:
            self.token_url = f"{AUTHENTIK_HOST}/application/o/{AUTHENTIK_APP_NAME}/token/"
            self.userinfo_url = f"{AUTHENTIK_HOST}/application/o/{AUTHENTIK_APP_NAME}/userinfo/"
            authorize_endpoint = f"{AUTHENTIK_HOST}/application/o/{AUTHENTIK_APP_NAME}/authorize/"

        client_id = AUTHENTIK_CLIENT_ID
        client_secret = AUTHENTIK_CLIENT_SECRET

        forwarded_proto = request.META.get("HTTP_X_FORWARDED_PROTO", "")
        is_secure = forwarded_proto == "https" or request.is_secure()
        redirect_uri = f"{'https' if is_secure else 'http'}://{request.get_host()}/auth/authentik/callback/"
        url_params = {
            "client_id": client_id,
            "scope": self.scope,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }
        auth_url = f"{authorize_endpoint}?{urlencode(url_params)}"

        super().__init__(
            request,
            self.provider,
            client_id,
            self.scope,
            redirect_uri,
            auth_url,
            self.token_url,
            self.userinfo_url,
            client_secret,
            code,
            callback=callback,
        )

    def set_token_data(self):
        data = {
            "code": self.code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        headers = {"Accept": "application/json"}
        token_response = self.get_user_token(data=data, headers=headers)
        super().set_token_data(
            {
                "access_token": token_response.get("access_token"),
                "refresh_token": token_response.get("refresh_token", None),
                "access_token_expired_at": (
                    datetime.now(tz=pytz.utc) + timedelta(seconds=token_response.get("expires_in"))
                    if token_response.get("expires_in")
                    else None
                ),
                "refresh_token_expired_at": (
                    datetime.fromtimestamp(token_response.get("refresh_token_expired_at"), tz=pytz.utc)
                    if token_response.get("refresh_token_expired_at")
                    else None
                ),
                "id_token": token_response.get("id_token", ""),
            }
        )

    def set_user_data(self):
        user_info_response = self.get_user_response()
        super().set_user_data(
            {
                "email": user_info_response.get("email"),
                "user": {
                    "provider_id": user_info_response.get("sub"),
                    "email": user_info_response.get("email"),
                    "avatar": user_info_response.get("picture"),
                    "first_name": user_info_response.get("given_name")
                        or (user_info_response.get("name", "").split(" ", 1)[0] if user_info_response.get("name") else ""),
                    "last_name": user_info_response.get("family_name")
                        or (user_info_response.get("name", "").split(" ", 1)[1] if user_info_response.get("name") and " " in user_info_response.get("name", "") else ""),
                    "is_password_autoset": True,
                },
            }
        )
