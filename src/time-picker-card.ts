import { computeDomain, HomeAssistant, LovelaceCard } from 'custom-card-helpers';
import { HassEntity } from 'home-assistant-js-websocket';
import {
  css,
  CSSResult,
  customElement,
  html,
  LitElement,
  property,
  TemplateResult,
} from 'lit-element';
import { CARD_SIZE, CARD_VERSION, DEFAULT_LAYOUT_HOUR_MODE, ENTITY_DOMAIN } from './const';
import { Hour } from './models/hour';
import { Minute } from './models/minute';
import { Partial } from './partials';
import { Period, TimePickerCardConfig } from './types';

import './components/time-period.component';
import './components/time-unit.component';
import './editor';

console.info(
  `%c  TIME-PICKER-CARD  \n%c  Version ${CARD_VERSION}    `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray'
);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'time-picker-card',
  name: 'Time Picker Card',
  description: 'A Time Picker card for setting the time value of Input Datetime entities.',
});

@customElement('time-picker-card')
export class TimePickerCard extends LitElement implements LovelaceCard {
  @property({ type: Object }) hass!: HomeAssistant;
  @property() private config!: TimePickerCardConfig;
  @property() private hour!: Hour;
  @property() private minute!: Minute;
  @property() private period!: Period;

  private get entity(): HassEntity | undefined {
    return this.hass.states[this.config.entity];
  }

  private get shouldShowName(): boolean {
    return Boolean(this.config.hide?.name) === false && Boolean(this.name);
  }

  private get name(): string | undefined {
    return this.config.name || this.entity?.attributes.friendly_name;
  }

  private get shouldShowPeriod(): boolean {
    return this.config.hour_mode === 12;
  }

  render(): TemplateResult | null {
    if (!this.entity) {
      return Partial.error('Entity not found', this.config);
    }

    if (computeDomain(this.entity.entity_id) !== ENTITY_DOMAIN) {
      return Partial.error(`You must set an ${ENTITY_DOMAIN} entity`, this.config);
    }

    if (!this.entity.attributes.has_time) {
      return Partial.error(
        `You must set an ${ENTITY_DOMAIN} entity that sets has_time: true`,
        this.config
      );
    }

    const { hour, minute } = this.entity!.attributes;
    this.hour = new Hour(hour, this.config.hour_step, this.config.hour_mode);
    this.minute = new Minute(minute, this.config.minute_step);
    this.period = this.hour.value >= 12 ? Period.PM : Period.AM;

    return html`
      <ha-card>
        ${this.shouldShowName ? Partial.header(this.name!) : ''}
        <div class="time-picker-content">
          <time-unit .unit=${this.hour} @update=${this.callHassService}></time-unit>
          <div class="time-separator">:</div>
          <time-unit .unit=${this.minute} @update=${this.callHassService}></time-unit>

          ${this.shouldShowPeriod
            ? html`<time-period
                .period=${this.period}
                .mode=${this.config.layout?.hour_mode ?? DEFAULT_LAYOUT_HOUR_MODE}
                @toggle=${this.onPeriodToggle}
              ></time-period>`
            : ''}
        </div>
      </ha-card>
    `;
  }

  setConfig(config): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }

    if (!config.entity) {
      throw new Error('You must set an entity');
    }

    if (config.hour_mode && config.hour_mode !== 12 && config.hour_mode !== 24) {
      throw new Error('Invalid hour_mode: select either 12 or 24');
    }

    this.config = config;
  }

  getCardSize(): number {
    return CARD_SIZE;
  }

  private onPeriodToggle(): void {
    this.hour.togglePeriod();
    this.callHassService();
  }

  private callHassService(): Promise<void> {
    if (!this.hass) {
      throw new Error('Unable to update datetime');
    }

    const time = `${this.hour.value}:${this.minute.value}:00`;

    return this.hass.callService(ENTITY_DOMAIN, 'set_datetime', {
      entity_id: this.entity!.entity_id,
      time,
    });
  }

  static get styles(): CSSResult {
    return css`
      :host {
        --tpc-elements-background-color: var(
          --time-picker-elements-background-color,
          var(--primary-color)
        );

        --tpc-icon-color: var(--time-picker-icon-color, var(--primary-text-color));
        --tpc-text-color: var(--time-picker-text-color, #fff);
        --tpc-accent-color: var(--time-picker-accent-color, var(--primary-color));
        --tpc-off-color: var(--time-picker-off-color, var(--disabled-text-color));
      }

      .time-picker-header {
        padding: 16px;
        color: var(--tpc-text-color);
        background-color: var(--tpc-elements-background-color);
        font-size: 1em;
        text-align: center;
      }

      .time-picker-content {
        padding: 8px 16px 16px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
      }
    `;
  }

  static getStubConfig(
    _: HomeAssistant,
    entities: Array<string>
  ): Omit<TimePickerCardConfig, 'type'> {
    const datetimeEntity = entities.find((entityId) => computeDomain(entityId) === ENTITY_DOMAIN);

    return {
      entity: datetimeEntity || 'input_datetime.example_entity',
      hour_mode: 24,
      hour_step: 1,
      minute_step: 5,
    };
  }

  static getConfigElement(): LovelaceCard {
    return document.createElement('time-picker-card-editor') as LovelaceCard;
  }
}
