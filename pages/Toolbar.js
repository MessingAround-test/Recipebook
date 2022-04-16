import Modal from 'react-bootstrap/Modal'
import Navbar from 'react-bootstrap/Navbar'
import Container from 'react-bootstrap/Container'
import Nav from 'react-bootstrap/Nav'
import NavDropdown from 'react-bootstrap/NavDropdown'
import React from "react";
import { AiFillPlusCircle } from "react-icons/ai";

export function Toolbar(props) {
    const clearCookie = async function(e) {
        localStorage.removeItem("Token");
    }
    return (
        <div>
            
            <Navbar bg="dark" expand="lg" variant='dark' style={{"borderRadius": "0rem 0rem 0rem 0rem"}}>
                <Container>
                    <Navbar.Brand href="/">Bryns garbage</Navbar.Brand>
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
                            <Nav.Link href="/createRecipe"><AiFillPlusCircle/></Nav.Link>
                            
                            <Nav.Link href="/profile">Profile</Nav.Link>
                            <Nav.Link href="/login" onClick={(e)=>clearCookie(e)}>Logout</Nav.Link>
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
            {/* {props.children} */}

        </div>

    );
}


