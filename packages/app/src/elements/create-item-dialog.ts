import { Vault } from "@padloc/core/src/vault";
import { VaultItem, Field, ItemTemplate, ITEM_TEMPLATES, FieldType } from "@padloc/core/src/item";
import { translate as $l } from "@padloc/locale/src/translate";
import { app, router } from "../globals";
import { Select } from "./select";
import { Dialog } from "./dialog";
import "./scroller";
import "./button";
import { customElement, query, state } from "lit/decorators.js";
import { css, html } from "lit";
import "./icon";
import { checkFeatureDisabled } from "../lib/provisioning";

@customElement("pl-create-item-dialog")
export class CreateItemDialog extends Dialog<Vault, VaultItem> {
    @query("#vaultSelect")
    private _vaultSelect: Select<Vault>;

    @state()
    private _vault: Vault | null = null;

    @state()
    private _template: ItemTemplate = ITEM_TEMPLATES[0];

    @state()
    private _suggestedTemplate: ItemTemplate | null = null;

    private get _org() {
        return this._vault?.org && app.getOrg(this._vault.org.id);
    }

    readonly preventDismiss = true;

    static styles = [
        ...Dialog.styles,
        css`
            .inner {
                max-width: 500px;
            }

            .template img {
                width: 1.2em;
                height: 1.2em;
            }
        `,
    ];

    renderContent() {
        const templates = this._suggestedTemplate ? [this._suggestedTemplate, ...ITEM_TEMPLATES] : ITEM_TEMPLATES;
        return html`
            <header class="huge double-padded text-centering">${$l("New Vault Item")}</header>

            <pl-scroller class="stretch">
                <div class="horizontally-double-padded">
                    <pl-select
                        id="vaultSelect"
                        icon="vault"
                        .label=${$l("Select Vault")}
                        .options=${app.vaults.map((v) => ({
                            value: v,
                            disabled: !app.isEditable(v),
                        }))}
                        @change=${this._vaultSelected}
                    ></pl-select>

                    <div class="double-margined text-centering">${$l("What kind of item you would like to add?")}</div>

                    <div class="grid">
                        ${templates.map(
                            (template) => html`
                                <pl-button
                                    class="horizontal center-aligning text-left-aligning spacing layout template ghost"
                                    @click=${() => this._selectTemplate(template)}
                                    .toggled=${this._template === template}
                                >
                                    ${template.iconSrc
                                        ? html`<img .src=${template.iconSrc} />`
                                        : html` <pl-icon icon=${template.icon} class="icon"></pl-icon> `}
                                    <div class="stretch ellipsis">${template.toString()}</div>
                                </pl-button>
                            `
                        )}
                    </div>
                </div>
                <div class="spacer"></div>
            </pl-scroller>

            <footer class="double-padded evenly stretching spacing horizontal layout">
                <pl-button @click=${() => this._enter()} class="primary" ?disabled=${!this._vault}
                    >${$l("Create")}</pl-button
                >

                <pl-button @click=${() => this.done()}>${$l("Cancel")}</pl-button>
            </footer>
        `;
    }

    private _checkAttachmentsDisabled() {
        return this._org
            ? checkFeatureDisabled(app.getOrgFeatures(this._org).attachments, this._org.isOwner(app.account!))
            : checkFeatureDisabled(app.getAccountFeatures().attachments);
    }

    private _checkTotpDisabled() {
        return this._org
            ? checkFeatureDisabled(app.getOrgFeatures(this._org).totpField, this._org.isOwner(app.account!))
            : checkFeatureDisabled(app.getAccountFeatures().totpField);
    }

    private _checkNotesDisabled() {
        return this._org
            ? checkFeatureDisabled(app.getOrgFeatures(this._org).notesField, this._org.isOwner(app.account!))
            : checkFeatureDisabled(app.getAccountFeatures().notesField);
    }

    private _vaultSelected() {
        this._vault = this._vaultSelect.value;
        this._template = this._suggestedTemplate || ITEM_TEMPLATES[0];
    }

    private _selectTemplate(template: ItemTemplate) {
        if (template.attachment && this._checkAttachmentsDisabled()) {
            return;
        }
        if (template.fields.some((field) => field.type === FieldType.Note) && this._checkNotesDisabled()) {
            return;
        }
        if (template.fields.some((field) => field.type === FieldType.Totp) && this._checkTotpDisabled()) {
            return;
        }

        this._template = template;
    }

    private async _enter() {
        const vault = this._vault;

        if (!vault) {
            return;
        }

        const item = await app.createItem({
            name: this._template.name || "",
            vault,
            icon: this._template.icon,
            fields: this._template.fields.map((f) => new Field({ ...f, value: f.value || "" })),
        });
        this.done(item);

        const params = { ...router.params } as any;
        if (this._template.attachment) {
            params.action = "addAttachment";
        }
        router.go(`items/${item.id}/new`, params);
    }

    async show(vault: Vault = app.mainVault!) {
        await this.updateComplete;
        this._vault = this._vaultSelect.value = app.isEditable(vault) ? vault : null;
        const { url, favIconUrl } = app.state.context.browser || {};
        if (url) {
            const parsedUrl = new URL(url);
            const hostName = parsedUrl.hostname.replace(/^www\./, "");
            let name = hostName.split(".").slice(-2).join(".");
            name = name[0]?.toUpperCase() + name.slice(1);
            this._suggestedTemplate = {
                toString: () => name || $l("Current Tab"),
                name,
                icon: "web",
                iconSrc: favIconUrl,
                fields: [
                    {
                        name: $l("Username"),
                        type: FieldType.Username,
                        value: "",
                    },
                    {
                        name: $l("Password"),
                        type: FieldType.Password,
                        value: "",
                    },
                    {
                        name: $l("URL"),
                        type: FieldType.Url,
                        value: parsedUrl.origin,
                    },
                ],
            };
        } else {
            this._suggestedTemplate = null;
        }
        this._template = this._suggestedTemplate || ITEM_TEMPLATES[0];
        return super.show();
    }
}
