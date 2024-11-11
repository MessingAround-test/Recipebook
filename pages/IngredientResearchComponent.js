import Head from 'next/head';
import { useEffect, useState } from 'react';
import { Table, Form, Button, Spinner, Card, Row, Col } from 'react-bootstrap';
import { quantity_unit_conversions } from "../lib/conversion";

const categories = [
    { name: 'Fresh Produce' },
    { name: 'Dairy and Eggs' },
    { name: 'Bakery' },
    // Add more categories as needed...
];

export default function IngredientResearchComponent() {
    const [userData, setUserData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [ingredientData, setIngredientData] = useState([]);
    const [quantity, setQuantity] = useState(1);
    const [quantityUnit, setQuantityUnit] = useState('any');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(false);

    async function getUserDetails() {
        let data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))).json();
        setUserData(data.res);
    }

    async function handleGetIngredient(e) {
        e.preventDefault();
        setLoading(true);

        const data = await (await fetch(`/api/Ingredients/?name=${searchTerm}&qType=${quantityUnit}&quantity=${quantity}&EDGEtoken=${localStorage.getItem('Token')}`)).json();
        setLoading(false);

        if (data.loadedSource === true) {
            const data = await (await fetch(`/api/Ingredients/?name=${searchTerm}&qType=${quantityUnit}&quantity=${quantity}&EDGEtoken=${localStorage.getItem('Token')}`)).json();
            setIngredientData(data.res);
        } else {
            setIngredientData(data.res);
        }
    }

    // Helper function to get the top 3 ranked products
    function getTopProducts() {
        // Sort all products by rank
        const sortedProducts = [...ingredientData].sort((a, b) => a.rank - b.rank);

        // Return the top 3 products (Gold, Silver, Bronze)
        return sortedProducts.slice(0, 3);
    }

    return (
        <div>
            <Form onSubmit={handleGetIngredient}>
                <Form.Group className="mb-3 d-flex align-items-center">
                    <Form.Control
                        name="ingredName"
                        value={searchTerm}
                        type="text"
                        placeholder="Enter ingredient name"
                        onChange={(e) => setSearchTerm(e.target.value)}
                        required
                        className="me-2"
                        autoComplete='off'
                    />
                    <Button variant="primary" type="submit">Submit</Button>
                </Form.Group>
            </Form>

            {/* Extra options to select quantity and category */}
            <Form.Group className="mb-3">
                <Form.Label>Quantity</Form.Label>
                <Form.Control
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Unit</Form.Label>
                <Form.Select aria-label="Default select example" name="quantity_type" id="quantity_type" onChange={(e) => setQuantityUnit(e.target.value)} value={quantityUnit} required>
                    <option value="any">any</option>
                    {Object.keys(quantity_unit_conversions).map((item) => <option key={item} value={item}>{item}</option>)}
                </Form.Select>
            </Form.Group>

            {/* Display loading spinner while data is being fetched */}
            {loading && <Spinner animation="border" role="status" style={{ color: 'black' }}><span className="visually-hidden">Loading...</span></Spinner>}

            {/* Display the top 3 ranked products (Gold, Silver, Bronze) */}
            {ingredientData.length > 0 && (
                <div>
                    <h3>Top 3 Products</h3>
                    <Row className="mb-5">
                        {getTopProducts().map((product, index) => (
                            <Col key={index} md={4}>
                            <Card
                              className="mb-3 text-black"
                              style={{
                                border: '1px solid #ccc',
                                borderRadius: '8px',
                                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                                position: 'relative', // for positioning the image in top-right corner
                              }}
                            >
                              {/* Colored Bar at the Top */}
                              <div
                                style={{
                                  height: '8px', // bar height
                                  backgroundColor:
                                    index === 0
                                      ? '#FFD700' // Gold
                                      : index === 1
                                      ? '#C0C0C0' // Silver
                                      : '#CD7F32', // Bronze
                                  borderTopLeftRadius: '8px',
                                  borderTopRightRadius: '8px',
                                }}
                              ></div>
                          
                              <Card.Body
                                style={{
                                  paddingTop: '1rem', // space for the bar
                                  color: index === 0 || index === 2 ? 'black' : 'inherit', // Text color for Gold and Bronze
                                }}
                              >
                                <Card.Title>
                                  <span
                                    style={{ fontSize: '1.2rem', fontWeight: 'bold' }}
                                  >
                                    {index === 0 ? '#1' : index === 1 ? '#2' : '#3'}
                                  </span>
                                  <h5 style={{ marginTop: '0.5rem' }}>{product.name}</h5>
                                </Card.Title>
                          
                                {/* Supplier Image in the top right corner */}
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '1rem',
                                    right: '1rem',
                                    width: '40px', // small size for the image
                                    height: 'auto',
                                  }}
                                >
                                  <img
                                    src={`${product.source}.png`}
                                    alt="Supplier"
                                    style={{
                                      maxWidth: '100%',
                                      borderRadius: '8px',
                                      border: '1px solid #ddd',
                                    }}
                                  />
                                </div>
                          
                                <Card.Subtitle className="mb-2 text-muted text-center">{product.source}</Card.Subtitle>
                          
                                <Card.Text className="text-center" style={{ fontSize: '1rem', lineHeight: '1.5' }}>
                                  <div>
                                    <strong>Price:</strong> ${product.price.toFixed(2)}
                                  </div>
                                  <div>
                                    <strong>Unit Price:</strong>{' '}
                                    {product.unit_price_converted < 1
                                      ? `${(product.unit_price_converted * 100).toFixed(2)}¢`
                                      : `$${product.unit_price_converted.toFixed(2)}`}
                                  </div>
                                  <div>
                                    <strong>Quantity:</strong> {product.quantity} {product.quantity_unit}
                                  </div>
                                  <div>
                                    <strong>Percent:</strong> {/* Add percent logic here */}
                                  </div>
                                </Card.Text>
                              </Card.Body>
                            </Card>
                          </Col>
                          
                          
                                 

                         
                        ))}
                    </Row>
                </div>
            )}

            {/* Display the table for all products */}
            {ingredientData.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                <Table striped bordered hover>
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th>Price</th>
                            <th>Unit Price</th>
                            <th>Quantity</th>
                            <th>Source</th>
                            <th>Rank</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ingredientData.map((product, idx) => (
                            <tr key={idx}>
                                <td>{product.name}</td>
                                <td>${product.price.toFixed(2)}</td>
                                <td>{product.unit_price_converted < 1 ? `${(product.unit_price_converted * 100).toFixed(2)}¢` : `$${product.unit_price_converted.toFixed(2)}`}</td>
                                <td>{product.quantity} {product.quantity_unit}</td>
                                <td>{product.source}</td>
                                <td>{product.rank}</td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>
            
            )}
        </div>
    );
}
