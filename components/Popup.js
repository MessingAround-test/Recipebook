import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'

import Table from 'react-bootstrap/Table';

import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Router from 'next/router'
import Modal from 'react-modal';


// props.isOpen and props.details
export function Popup(props) {
    const customStyles = {
        content: {
            "backgroundColor": "grey"
        }
    }
    const redirect = async function (page) {
        Router.push(page)
    };
    const [details, setDetails] = useState(props.details)
    const [modalIsOpen, setIsOpen] = useState((props.isOpen == undefined) ? false : props.isOpen)
    async function openModal(ingredName) {
        setIsOpen(true);
        setSelectedIngred(ingredName)
    }



    async function closeModal() {
        setIsOpen(false);
    }

    return (
        (props.details === undefined ? (
            <div>

            </div>
        ) :
            <>
                <div>
                    <Modal
                        isOpen={modalIsOpen}
                        onRequestClose={closeModal}
                        style={customStyles}
                        contentLabel="Modal"
                    >
                        <button style={{ float: "right", "borderRadius": "5px" }} onClick={closeModal}><img style={{ "maxWidth": "32px", "maxHeight": "32px" }} src={"/cross.png"}></img></button>
                        <h2>More Details</h2>
                        {
                            Object.keys(props.details).map(key => (
                                <div key={key}>{key}: {props.details[key]}</div>
                            )
                            )
                        }
                    </Modal>

                </div>

            </>
        )
    )
}
