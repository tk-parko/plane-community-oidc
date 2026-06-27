/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { isEmpty } from "lodash-es";
import Link from "next/link";
import { useForm } from "react-hook-form";
// plane internal packages
import { API_BASE_URL } from "@plane/constants";
import { Button, getButtonStyling } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IFormattedInstanceConfiguration, TInstanceAuthentikAuthenticationConfigurationKeys } from "@plane/types";
// components
import { CodeBlock } from "@/components/common/code-block";
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import type { TControllerSwitchFormField } from "@/components/common/controller-switch";
import { ControllerSwitch } from "@/components/common/controller-switch";
import type { TCopyField } from "@/components/common/copy-field";
import { CopyField } from "@/components/common/copy-field";
// hooks
import { useInstance } from "@/hooks/store";

type Props = {
  config: IFormattedInstanceConfiguration;
};

type AuthentikConfigFormValues = Record<TInstanceAuthentikAuthenticationConfigurationKeys, string>;

export function InstanceAuthentikConfigForm(props: Props) {
  const { config } = props;
  // states
  const [isDiscardChangesModalOpen, setIsDiscardChangesModalOpen] = useState(false);
  // store hooks
  const { updateInstanceConfigurations } = useInstance();
  // form data
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<AuthentikConfigFormValues>({
    defaultValues: {
      AUTHENTIK_HOST: config["AUTHENTIK_HOST"] || "https://auth.example.com",
      AUTHENTIK_APP_NAME: config["AUTHENTIK_APP_NAME"],
      AUTHENTIK_CLIENT_ID: config["AUTHENTIK_CLIENT_ID"],
      AUTHENTIK_CLIENT_SECRET: config["AUTHENTIK_CLIENT_SECRET"],
      ENABLE_AUTHENTIK_SYNC: config["ENABLE_AUTHENTIK_SYNC"] || "0",
    },
  });

  const originURL = !isEmpty(API_BASE_URL) ? API_BASE_URL : typeof window !== "undefined" ? window.location.origin : "";

  const AUTHENTIK_FORM_FIELDS: TControllerInputFormField[] = [
    {
      key: "AUTHENTIK_HOST",
      type: "text",
      label: "Authentik Host",
      description: <>Use the URL of your Authentik instance (e.g. https://auth.example.com).</>,
      placeholder: "https://auth.example.com",
      error: Boolean(errors.AUTHENTIK_HOST),
      required: true,
    },
    {
      key: "AUTHENTIK_APP_NAME",
      type: "text",
      label: "Application Name",
      description: (
        <>
          The OAuth2/OIDC application name in Authentik. You can find this in your{" "}
          <a
            tabIndex={-1}
            href="https://docs.goauthentik.io/docs/add-secure-apps/providers/oauth2/"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            Authentik provider settings.
          </a>
        </>
      ),
      placeholder: "plane",
      error: Boolean(errors.AUTHENTIK_APP_NAME),
      required: true,
    },
    {
      key: "AUTHENTIK_CLIENT_ID",
      type: "text",
      label: "Client ID",
      description: (
        <>
          You will get this from your Authentik OAuth2/OIDC provider configuration.
        </>
      ),
      placeholder: "YOUR_CLIENT_ID",
      error: Boolean(errors.AUTHENTIK_CLIENT_ID),
      required: true,
    },
    {
      key: "AUTHENTIK_CLIENT_SECRET",
      type: "password",
      label: "Client secret",
      description: (
        <>
          Your client secret from your Authentik OAuth2/OIDC provider configuration.
        </>
      ),
      placeholder: "YOUR_CLIENT_SECRET",
      error: Boolean(errors.AUTHENTIK_CLIENT_SECRET),
      required: true,
    },
  ];

  const AUTHENTIK_FORM_SWITCH_FIELD: TControllerSwitchFormField<AuthentikConfigFormValues> = {
    name: "ENABLE_AUTHENTIK_SYNC",
    label: "Authentik",
  };

  const AUTHENTIK_SERVICE_FIELD: TCopyField[] = [
    {
      key: "Callback_URI",
      label: "Callback URI",
      url: `${originURL}/auth/authentik/callback/`,
      description: (
        <>
          We will auto-generate this. Paste this into the{" "}
          <CodeBlock darkerShade>Redirect URIs/Authorized redirect URIs</CodeBlock> field in your Authentik provider
          configuration.
        </>
      ),
    },
  ];

  const onSubmit = async (formData: AuthentikConfigFormValues) => {
    const payload: Partial<AuthentikConfigFormValues> = { ...formData };

    try {
      const response = await updateInstanceConfigurations(payload);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Done!",
        message: "Your Authentik authentication is configured. You should test it now.",
      });
      reset({
        AUTHENTIK_HOST: response.find((item) => item.key === "AUTHENTIK_HOST")?.value,
        AUTHENTIK_APP_NAME: response.find((item) => item.key === "AUTHENTIK_APP_NAME")?.value,
        AUTHENTIK_CLIENT_ID: response.find((item) => item.key === "AUTHENTIK_CLIENT_ID")?.value,
        AUTHENTIK_CLIENT_SECRET: response.find((item) => item.key === "AUTHENTIK_CLIENT_SECRET")?.value,
        ENABLE_AUTHENTIK_SYNC: response.find((item) => item.key === "ENABLE_AUTHENTIK_SYNC")?.value,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleGoBack = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (isDirty) {
      e.preventDefault();
      setIsDiscardChangesModalOpen(true);
    }
  };

  return (
    <>
      <ConfirmDiscardModal
        isOpen={isDiscardChangesModalOpen}
        onDiscardHref="/authentication"
        handleClose={() => setIsDiscardChangesModalOpen(false)}
      />
      <div className="flex flex-col gap-8">
        <div className="grid w-full grid-cols-2 gap-x-12 gap-y-8">
          <div className="col-span-2 flex flex-col gap-y-4 pt-1 md:col-span-1">
            <div className="pt-2.5 text-18 font-medium">Authentik-provided details for Plane</div>
            {AUTHENTIK_FORM_FIELDS.map((field) => (
              <ControllerInput
                key={field.key}
                control={control}
                type={field.type}
                name={field.key}
                label={field.label}
                description={field.description}
                placeholder={field.placeholder}
                error={field.error}
                required={field.required}
              />
            ))}
            <ControllerSwitch control={control} field={AUTHENTIK_FORM_SWITCH_FIELD} />
            <div className="flex flex-col gap-1 pt-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={(e) => void handleSubmit(onSubmit)(e)}
                  loading={isSubmitting}
                  disabled={!isDirty}
                >
                  {isSubmitting ? "Saving" : "Save changes"}
                </Button>
                <Link href="/authentication" className={getButtonStyling("secondary", "lg")} onClick={handleGoBack}>
                  Go back
                </Link>
              </div>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="flex flex-col gap-y-4 rounded-lg bg-layer-1 px-6 pt-1.5 pb-4">
              <div className="pt-2 text-18 font-medium">Plane-provided details for Authentik</div>
              {AUTHENTIK_SERVICE_FIELD.map((field) => (
                <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
