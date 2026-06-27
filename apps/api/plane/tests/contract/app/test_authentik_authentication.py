import pytest
from django.urls import reverse


@pytest.mark.contract
class TestAppAuthentikCallback:
    """Tests for Authentik OAuth callback (app)"""

    @pytest.mark.django_db
    def test_callback_without_session_host_is_not_500(self, api_client):
        """
        Regression: callback without 'host' in session must redirect (302),
        not crash with UnboundLocalError (HTTP 500).

        The bug was that the local variable 'base_host' on line 65 shadowed the
        imported function of the same name, causing UnboundLocalError when
        session['host'] was None. Fixed by renaming the local to 'host'.
        """
        url = reverse("authentik-callback")
        session = api_client.session
        session["state"] = "expected-state"
        session.save()
        response = api_client.get(url, {"code": "test-code", "state": "wrong-state"})
        assert response.status_code == 302
