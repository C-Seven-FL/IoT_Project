// Tower Kit documentation https://tower.hardwario.com/
// SDK API description https://sdk.hardwario.com/
// Forum https://forum.hardwario.com/

#include <application.h>

// LED instance
twr_led_t led;

// Button instance
twr_button_t button;

// Thermometer instance
twr_tmp112_t tmp112;
uint16_t button_click_count = 0;

// Accelerometr
twr_lis2dh12_t a;
twr_lis2dh12_result_g_t a_result;

float g_temperature = 0;
twr_lis2dh12_result_g_t g_acc;


// Button event callback
void button_event_handler(twr_button_t *self, twr_button_event_t event, void *event_param)
{
    // Log button event
    twr_log_info("ID524342: Button:%i", event);

    // Check event source
    if (event == TWR_BUTTON_EVENT_RELEASE)
    {
        // Toggle LED pin state
        twr_led_set_mode(&led, TWR_LED_MODE_TOGGLE);

         // Publish message on radio
        button_click_count++;
        twr_radio_pub_push_button(&button_click_count);
    }

    if (event == TWR_BUTTON_EVENT_PRESS)
    {
        // Toggle LED pin state
        twr_led_set_mode(&led, TWR_LED_MODE_TOGGLE);

         // Publish message on radio
        button_click_count++;
        twr_radio_pub_push_button(&button_click_count);
    }
}

// Accelerometr
void lis2_event_handler(twr_lis2dh12_t *self, twr_lis2dh12_event_t event, void *event_param)
{
    (void) self;
    (void) event_param;

    if (event == TWR_LIS2DH12_EVENT_UPDATE) {
        twr_lis2dh12_get_result_g(&a, &g_acc);
        //twr_log_debug("ID524342: X:%f\rY:%f\rZ:%f\r", a_result.x_axis, a_result.y_axis, a_result.z_axis);
    } else {
        twr_log_debug("error");
    }
}

void tmp112_event_handler(twr_tmp112_t *self, twr_tmp112_event_t event, void *event_param)
{
    if (event == TWR_TMP112_EVENT_UPDATE)
    {
        float celsius;
        // Read temperature
        twr_tmp112_get_temperature_celsius(self, &g_temperature);

        // twr_log_debug("ID524342: temperature:%.2f", celsius);

        twr_radio_pub_temperature(TWR_RADIO_PUB_CHANNEL_R1_I2C0_ADDRESS_ALTERNATE, &celsius);
    }
}

// Application initialization function which is called once after boot
void application_init(void)
{
    // Initialize logging
    twr_log_init(TWR_LOG_LEVEL_DUMP, TWR_LOG_TIMESTAMP_ABS);

    // Initialize LED
    twr_led_init(&led, TWR_GPIO_LED, false, 0);
    twr_led_pulse(&led, 2000);

    // Initialize button
    twr_button_init(&button, TWR_GPIO_BUTTON, TWR_GPIO_PULL_DOWN, 0);
    twr_button_set_event_handler(&button, button_event_handler, NULL);
    twr_button_set_click_timeout(&button, 0);
    twr_button_set_debounce_time(&button, 20);

    // Initialize thermometer on core module
    twr_tmp112_init(&tmp112, TWR_I2C_I2C0, 0x49);
    twr_tmp112_set_event_handler(&tmp112, tmp112_event_handler, NULL);
    twr_tmp112_set_update_interval(&tmp112, 5000);

    // Initialize accelerometr
    twr_lis2dh12_init(&a, TWR_I2C_I2C0, 0x19);
    twr_lis2dh12_set_event_handler(&a, lis2_event_handler, NULL);
    twr_lis2dh12_set_update_interval(&a, 1000);

    // Initialize radio
    twr_radio_init(TWR_RADIO_MODE_NODE_SLEEPING);
    // Send radio pairing request
    twr_radio_pairing_request("skeleton", FW_VERSION);
}

void application_task(void)
{


    // Log task run and increment counter
    twr_log_debug("ID524342: T:%.2f X:%f Y:%f Z:%f",
            g_temperature,
            g_acc.x_axis,
            g_acc.y_axis,
            g_acc.z_axis
        );

    // Plan next run of this task in 1000 ms
    twr_scheduler_plan_current_from_now(5000);
}