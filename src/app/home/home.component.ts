/// <reference types="web-bluetooth" />
/// <reference types="dom-serial" />

import {Component, Inject, OnInit} from '@angular/core';
import {DOCUMENT} from "@angular/common";
// @ts-ignore
import EscPosEncoder from 'esc-pos-encoder';
import {BehaviorSubject} from "rxjs";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  private window: Window | null;
  public hasBluetooth: boolean = false;
  public hasWebBluetooth: boolean = false;
  public hasUSB: boolean = false;
  public hasSPP: boolean = false;
  public hasCOM: boolean = false;

  public availableUSBDevices?: USBDevice[];
  public availableSerialPorts?: SerialPort[];
  public availableBluetoothDevices?: BluetoothDevice[];
  public selectedUSBDevice?: USBDevice;
  public selectedBluetoothDevice?: BluetoothDevice;
  public selectedCOMPort?: SerialPort;
  public selectedCOMPortOpened?: boolean = false;
  public selectedBluetoothDeviceConnecting: boolean = false;
  public selectedBluetoothDeviceReaderCharacteristic?: BluetoothRemoteGATTCharacteristic;
  public selectedBluetoothDeviceWriterCharacteristic?: BluetoothRemoteGATTCharacteristic;

  public consolePrinter: BehaviorSubject<string> = new BehaviorSubject<string>("");
  public consoleArray: string[] = [];

  constructor(@Inject(DOCUMENT) private document: Document) {
    this.window = this.document.defaultView;
  }

  ngOnInit(): void {
    this.checkAndLoad();
    this.consolePrinter.subscribe((str) => this.consoleArray.push(str));
  }

  checkAndLoad() {
    // Check Browser Bluetooth Availability
    this.consolePrinter.next("Check Browser Bluetooth Availability");
    if (this.window?.navigator.bluetooth) {
      // Check Hardware Bluetooth availability
      this.consolePrinter.next("Check Hardware Bluetooth availability");
      this.window?.navigator.bluetooth.getAvailability().then((isBluetoothAvailable: boolean) => {
        if (isBluetoothAvailable) {
          this.reloadBluetoothDevices();
          this.consolePrinter.next("Browser Bluetooth Not available");
          this.hasBluetooth = true;
        } else {
          this.consolePrinter.next("Browser Bluetooth Not available");
          this.hasBluetooth = false;
        }
      });

      // Check Web Bluetooth
      if (typeof this.window?.navigator.bluetooth['getDevices'] === 'function') {
        this.hasWebBluetooth = true;
      }
    } else {
      this.consolePrinter.next("Browser Bluetooth Not available");
    }

    // Check Web Bluetooth
    if (this.window?.navigator.usb) {
      this.hasUSB = true;
      // Check Usb devices
      this.reloadUsbDevices();
    }

    // Check Web Bluetooth
    if (this.window?.navigator.serial) {
      this.hasCOM = true;
      // Check Serial Ports
      this.reloadComPorts();
    }
  }

  reloadBluetoothDevices() {
    this.window?.navigator.bluetooth.getDevices().then(devices => {
      this.availableBluetoothDevices = devices;

      this.consolePrinter.next('Loaded');
    });
  }

  reloadUsbDevices() {
    this.window?.navigator.usb.getDevices().then(devices => {
      this.availableUSBDevices = devices;
    });
  }

  reloadComPorts() {
    this.window?.navigator.serial.getPorts().then((ports) => {
      this.availableSerialPorts = ports;
    })
  }

  requestBluetoothDevice() {
    this.window?.navigator.bluetooth.requestDevice({
      // filters: [],
      // acceptAllDevices: true,
      filters: [
        {
          // services: ['000018f0-0000-1000-8000-00805f9b34fb'],
          namePrefix: 'SUP'
        },
      ],
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    }).then((bluetoothDevice: BluetoothDevice) => {
      this.selectedBluetoothDevice = bluetoothDevice;
      this.reloadBluetoothDevices();
    })
  }

  requestUsbDevice() {
    this.window?.navigator.usb.requestDevice({
      filters: []
    }).then((usbDevice) => {
      this.selectedUSBDevice = usbDevice;
      this.reloadUsbDevices();
    })
  }

  requestCOMPort() {
    this.window?.navigator.serial.requestPort({
      filters: []
    }).then((port) => {
      debugger;
      this.selectedCOMPort = port;
      this.reloadComPorts();
    })
  }

  useBluetoothDevice(device: BluetoothDevice) {
    this.selectedBluetoothDevice = device;
  }

  forgetBluetoothDevice(device: BluetoothDevice) {
    device.forget().then(() => {
      this.reloadBluetoothDevices();
    })
  }

  forgetUSBDevice(device: USBDevice) {
    device.forget().then(() => {
      this.reloadUsbDevices();
    })
  }

  forgetCOMPort(port: SerialPort) {
    port.forget().then(() => {
      this.reloadComPorts();
    })
  }

  connectCOMPort(port: SerialPort) {
    this.selectedCOMPort = port;
  }

  toggleConnectSelectedBluetooth() {
    if (!this.selectedBluetoothDevice) {
      console.warn('No device were selected');
      return;
    }

    if (this.selectedBluetoothDevice?.gatt?.connected) {
      this.selectedBluetoothDevice?.gatt?.disconnect();
      this.selectedBluetoothDeviceReaderCharacteristic = undefined;
      this.selectedBluetoothDeviceWriterCharacteristic = undefined;
    } else {
      this.selectedBluetoothDeviceConnecting = true;
      this.selectedBluetoothDevice?.gatt?.connect()
        .then((server) => {

          // Get the server primary service for printer
          this.selectedBluetoothDevice?.gatt?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb')
            .then((bluetoothService) => {

              // Get and assign service characteristics
              bluetoothService.getCharacteristics().then(bluetoothCharacteristics => {
                bluetoothCharacteristics.forEach(char => {
                  if (char.properties.write) {
                    this.selectedBluetoothDeviceWriterCharacteristic = char;
                  }
                  if (char.properties.notify || char.properties.read) {
                    this.selectedBluetoothDeviceReaderCharacteristic = char;
                  }
                })
              })
            })
        })
        .catch((error) => {
          console.warn(error);
          this.selectedBluetoothDevice?.gatt?.disconnect();
          this.selectedBluetoothDeviceWriterCharacteristic = undefined;
          this.selectedBluetoothDeviceReaderCharacteristic = undefined;
        })
        .finally(() => {
          this.selectedBluetoothDeviceConnecting = false;
        });
    }
  }

  sampleBluetoothDevicePrint() {
    let encoder = new EscPosEncoder();
    // let imageEl = new Image(32, 48);
    // imageEl.src = 'data:image/png;base64,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';
    // let qrCode = 'tel:*125*1234567890123#';
    // let textEncoder = new TextEncoder();
    // let qrCodeArray = textEncoder.encode(qrCode);

    // imageEl.onload = () => {
    //
    // }

    let headerBody = encoder.initialize()
      // .codepage('windows1250')
      .align('center')
      // .size('normal')
      .height(2)
      .width(2)
      .text('Batelco')
      .newline()
      .height(1)
      .width(1)
      .text('Prepaid Voucher')
      .newline()
      .text('================================')
      .newline()
      .text('PIN: 1234567890123')
      .newline()
      .text('================================')
      .newline()
      .align('left')
      .table(
        [
          {
            align: 'left',
            marginLeft: 0,
            marginRight: 0,
            verticalAlign: 'bottom',
            width: 10
          },
          {
            align: 'right',
            marginLeft: 0,
            marginRight: 0,
            verticalAlign: 'bottom',
            width: 22
          }
        ],
        [
          [
            'Amount:',
            'BD 0.500',
          ],
          [
            'Serial:',
            '481907141',
          ],
          [
            'Date:',
            '27/06/2022',
          ],
          [
            'Time:',
            '12:16:14',
          ],
          [
            'Expiry:',
            '30/06/2024',
          ],
          [
            'User ID:',
            'BA0002',
          ],
        ]
      )
      .newline()
      .text('================================')
      .newline()
      // .qrcode('tel:*125*1234567890123#', 1, 4, 'l')
      // .raw([
      //   // select model
      //   0x1d,
      //   0x28,
      //   0x6b,
      //   0x04,
      //   0x00,
      //   0x31,
      //   0x41,
      //   0x32,
      //   0x00,
      //
      //   // size of module
      //   0x1d,
      //   0x28,
      //   0x6b,
      //   0x03,
      //   0x00,
      //   0x31,
      //   0x43,
      //   0x03,
      //
      //   // errorQR
      //   0x1d,
      //   0x28,
      //   0x6b,
      //   0x03,
      //   0x00,
      //   0x31,
      //   0x45,
      //   0x31,
      //
      //   // Store the data in the symbol
      //   0x1d,
      //   0x28,
      //   0x6b,
      //   (qrCode.length % 256),
      //   (qrCode.length / 256),
      //   0x31,
      //   0x50,
      //   0x30,
      //
      //   // data
      //   ...qrCodeArray,
      //
      //   // printQR
      //   0x1d,
      //   0x28,
      //   0x6b,
      //   0x03,
      //   0x00,
      //   0x31,
      //   0x51,
      //   0x30,
      // ])
      // .newline()
      // .text('===============================')
      // .cut('full')
      // .align('left')
      // .text('The voucher you want to print is whatever this bar code will be shown to you to print')
      // .newline()
      // .barcode('978020137962', "ean13", 32)
      // .newline()
      // .newline()
      // .qrcode('https://nielsleenheer.com')
      .encode();

    let encoderFooter = new EscPosEncoder();

    let footer = encoderFooter.initialize()
      .newline()
      .align('center')
      .text('To refill your account, input')
      .newline()
      .text('the below code in your phone:')
      .height(2)
      .width(2)
      .newline()
      .text('*125*PIN#')
      .newline()
      .newline()
      .height(1)
      .width(1)
      .text('For assistance, call 196')
      .newline()
      .text('===========Thank You============')
      .newline()
      .newline()
      .newline()
      .encode()

    this.chunkArrayBufferingSend([headerBody, footer]);
  }

  sampleCOMPortPrint() {
    let encoder = new EscPosEncoder();
    // let imageEl = new Image(32, 48);
    // imageEl.src = 'data:image/png;base64,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';
    // let qrCode = 'tel:*125*1234567890123#';
    // let textEncoder = new TextEncoder();
    // let qrCodeArray = textEncoder.encode(qrCode);

    // imageEl.onload = () => {
    //
    // }

    let headerBody = encoder.initialize()
      // .codepage('windows1250')
      .align('center')
      // .size('normal')
      .height(2)
      .width(2)
      .text('Batelco')
      .newline()
      .height(1)
      .width(1)
      .text('Prepaid Voucher')
      .newline()
      .text('================================')
      .newline()
      .text('PIN: 1234567890123')
      .newline()
      .text('================================')
      .newline()
      .align('left')
      .table(
        [
          {
            align: 'left',
            marginLeft: 0,
            marginRight: 0,
            verticalAlign: 'bottom',
            width: 10
          },
          {
            align: 'right',
            marginLeft: 0,
            marginRight: 0,
            verticalAlign: 'bottom',
            width: 22
          }
        ],
        [
          [
            'Amount:',
            'BD 0.500',
          ],
          [
            'Serial:',
            '481907141',
          ],
          [
            'Date:',
            '27/06/2022',
          ],
          [
            'Time:',
            '12:16:14',
          ],
          [
            'Expiry:',
            '30/06/2024',
          ],
          [
            'User ID:',
            'BA0002',
          ],
        ]
      )
      .newline()
      .text('================================')
      .newline()
      // .qrcode('tel:*125*1234567890123#', 1, 4, 'l')
      // .raw([
      //   // select model
      //   0x1d,
      //   0x28,
      //   0x6b,
      //   0x04,
      //   0x00,
      //   0x31,
      //   0x41,
      //   0x32,
      //   0x00,
      //
      //   // size of module
      //   0x1d,
      //   0x28,
      //   0x6b,
      //   0x03,
      //   0x00,
      //   0x31,
      //   0x43,
      //   0x03,
      //
      //   // errorQR
      //   0x1d,
      //   0x28,
      //   0x6b,
      //   0x03,
      //   0x00,
      //   0x31,
      //   0x45,
      //   0x31,
      //
      //   // Store the data in the symbol
      //   0x1d,
      //   0x28,
      //   0x6b,
      //   (qrCode.length % 256),
      //   (qrCode.length / 256),
      //   0x31,
      //   0x50,
      //   0x30,
      //
      //   // data
      //   ...qrCodeArray,
      //
      //   // printQR
      //   0x1d,
      //   0x28,
      //   0x6b,
      //   0x03,
      //   0x00,
      //   0x31,
      //   0x51,
      //   0x30,
      // ])
      // .newline()
      // .text('===============================')
      // .cut('full')
      // .align('left')
      // .text('The voucher you want to print is whatever this bar code will be shown to you to print')
      // .newline()
      // .barcode('978020137962', "ean13", 32)
      // .newline()
      // .newline()
      // .qrcode('https://nielsleenheer.com')
      .newline()
      .align('center')
      .text('To refill your account, input')
      .newline()
      .text('the below code in your phone:')
      .height(2)
      .width(2)
      .newline()
      .text('*125*PIN#')
      .newline()
      .newline()
      .height(1)
      .width(1)
      .text('For assistance, call 196')
      .newline()
      .text('===========Thank You============')
      .newline()
      .newline()
      .newline()
      .encode()

    this.writeStrToCOMPort(headerBody);
  }

  chunkArrayBufferingSend(zpls: Array<Uint8Array>) {
    this.chunkBufferingSend(zpls[0]);

    for (let x = 1; x < zpls.length; x++) {
      setTimeout(() => {
        this.chunkBufferingSend(zpls[x]);
      }, 1250);
    }
  }

  chunkBufferingSend(zpl: Uint8Array) {
    var maxChunk = 400;
    var j = 0;

    if (zpl.length > maxChunk) {
      for (var i = 0; i < zpl.length; i += maxChunk) {
        var subChunk;
        if (i + maxChunk <= zpl.length) {
          subChunk = zpl.slice(i, i + maxChunk);
        } else {
          subChunk = zpl.slice(i, zpl.length);
        }

        setTimeout(this.writeStrToCharacteristic, 250 * j, subChunk);
        j++;
      }
    } else {
      this.writeStrToCharacteristic(zpl);
    }
  }

  writeStrToCharacteristic(str: Uint8Array) {
    // let buffer = new ArrayBuffer(str.length);
    // let dataView = new DataView(buffer);
    // for (var i = 0; i < str.length; i++) {
    //   dataView.setUint8(i, str.charAt(i).charCodeAt(0));
    // }

    console.log('sending ' + str.length);
    var decoder = new TextDecoder('utf8');
    console.log(decoder.decode(str));
    console.log(btoa(decoder.decode(str)));

    return this.selectedBluetoothDeviceWriterCharacteristic?.writeValueWithResponse(str.buffer).then(() => {
      console.log('sent ' + str.length + ' chunk');
    })
  }

  writeStrToCOMPort(str: Uint8Array) {
    console.log('sending ' + str.length);
    var decoder = new TextDecoder('utf8');
    console.log(decoder.decode(str));
    console.log(btoa(decoder.decode(str)));

    if (this.selectedCOMPortOpened) {
      this.writerCOMPort(str);
    } else {
      this.selectedCOMPort?.open({baudRate: 19200}).then(() => {
        this.selectedCOMPortOpened = true;
        this.writerCOMPort(str);
      });
    }
  }

  writerCOMPort(str: Uint8Array) {
    let writer = this.selectedCOMPort?.writable.getWriter();
    writer?.write(str.buffer).then(() => {
      writer?.releaseLock();
      console.log('sent ' + str.length + ' chunk');
    });
  }
}
