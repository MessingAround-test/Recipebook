import Modal from 'react-bootstrap/Modal'
import Navbar from 'react-bootstrap/Navbar'
import Container from 'react-bootstrap/Container'
import Nav from 'react-bootstrap/Nav'
import NavDropdown from 'react-bootstrap/NavDropdown'
import React from "react";
import { AiFillPlusCircle } from "react-icons/ai";
import { useEffect, useState } from 'react'
import Image from 'next/image'
import styles from '../styles/Toolbar.module.css'
import { CgProfile } from 'react-icons/cg'
import {MdLogout} from 'react-icons/md'

export function Toolbar(props) {
    const clearCookie = async function (e) {
        localStorage.removeItem("Token");
    }

    const [stickyClass, setStickyClass] = useState('');

    useEffect(() => {
        window.addEventListener('scroll', stickNavbar);
        return () => window.removeEventListener('scroll', stickNavbar);
    }, []);

    const stickNavbar = () => {
        if (window !== undefined) {
            let windowHeight = window.scrollY;
            // window height changed for the demo
            windowHeight > 150 ? setStickyClass('sticky-nav') : setStickyClass('');
        }
    };



    return (
        <div className={styles.Container}>

            <Navbar expand="lg" variant='dark' style={{ "borderRadius": "0rem 0rem 0rem 0rem" }} className={styles.stickynav}>
                <Container>

                    <Navbar.Brand href="/">
                        Bryns Garbage
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto">
                            {/* <Nav.Link href="/">Home</Nav.Link> */}


                            {/* <NavDropdown title="Tools" id="basic-nav-dropdown"> */}
                            {/* <NavDropdown.Item href="/leaveGraph">Recipes</NavDropdown.Item> */}
                            {/* <NavDropdown.Item href="/docGen">Form Generator</NavDropdown.Item> */}
                            {/* <NavDropdown.Divider /> */}
                            {/* <NavDropdown.Item href="#action/3.4">Separated link</NavDropdown.Item> */}
                            {/* </NavDropdown> */}
                            <Nav.Link href="/recipes">Recipes</Nav.Link>
                            <Nav.Link href="/createRecipe"><AiFillPlusCircle /></Nav.Link>
                            <Nav.Link href="/ingredientResearch">Ingredient Research</Nav.Link>

                            <Nav.Link href="/budget">Budget</Nav.Link>

                        </Nav>
                    </Navbar.Collapse>
                    <Navbar.Collapse className="justify-content-end" >
                        <Nav.Link href="/profile" style={{"padding":"20px"}} >
                            <Navbar.Text>
                                <CgProfile size={25} />

                            </Navbar.Text>
                        </Nav.Link>
                        
                        <Nav.Link href="/login" onClick={(e) => clearCookie(e)} >
                            <Navbar.Text>
                                <MdLogout size={25}/>
                            </Navbar.Text>
                        </Nav.Link>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
            {/* {props.children} */}

        </div>

    );
}


